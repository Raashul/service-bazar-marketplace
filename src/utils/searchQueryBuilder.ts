import { SearchMetadata } from "../models/SearchMetadata";
import { pool } from "../config/database";
import { addImagesToProducts } from "./productImages";
import { mapQueryToCategories, buildCategorySearchConditions } from "../services/categoryMappingService";

interface QueryBuilder {
  baseQuery: string;
  whereConditions: string[];
  queryParams: any[];
  paramCount: number;
}

export const buildSearchQuery = (
  metadata: SearchMetadata,
  page: number = 1,
  limit: number = 20,
  fallbackQuery?: string
) => {
  const builder: QueryBuilder = {
    baseQuery: `
      SELECT p.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone
      FROM products p
      JOIN users u ON p.seller_id = u.id
    `,
    whereConditions: ["p.status = $1"],
    queryParams: ["active"],
    paramCount: 1,
  };

  // Text search in title, description, and enriched_tags
  if (metadata.keywords && metadata.keywords.length > 0) {
    const keywordConditions: string[] = [];

    metadata.keywords.forEach((keyword) => {
      builder.paramCount++;
      keywordConditions.push(`(
        p.title ILIKE $${builder.paramCount} OR 
        p.description ILIKE $${builder.paramCount} OR
        p.category ILIKE $${builder.paramCount} OR
        p.subcategory ILIKE $${builder.paramCount} OR
        EXISTS (
          SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
          WHERE enriched_tag ILIKE $${builder.paramCount}
        )
      )`);
      builder.queryParams.push(`%${keyword}%`);
    });

    // Add category mapping as additional OR conditions if fallbackQuery is provided
    if (fallbackQuery && fallbackQuery.trim().length > 0) {
      const categoryMappings = mapQueryToCategories(fallbackQuery.trim());
      if (categoryMappings.length > 0) {
        const { conditions, params, newParamCount } = buildCategorySearchConditions(
          categoryMappings, 
          builder.paramCount
        );
        
        if (conditions.length > 0) {
          keywordConditions.push(...conditions);
          builder.queryParams.push(...params);
          builder.paramCount = newParamCount;
          console.log('🔄 Added category mapping to keyword search:', conditions);
        }
      }
    }

    if (keywordConditions.length > 0) {
      builder.whereConditions.push(`(${keywordConditions.join(" OR ")})`);
    }
  } else if (fallbackQuery && fallbackQuery.trim().length > 0) {
    // Fallback search when no keywords are extracted
    console.log('🔄 Using fallback search for:', fallbackQuery.trim());
    
    // First try category mapping
    const categoryMappings = mapQueryToCategories(fallbackQuery.trim());
    console.log('🔄 Found category mappings:', categoryMappings);
    
    if (categoryMappings.length > 0) {
      // Use category-based search
      const { conditions, params, newParamCount } = buildCategorySearchConditions(
        categoryMappings, 
        builder.paramCount
      );
      
      if (conditions.length > 0) {
        builder.whereConditions.push(`(${conditions.join(' OR ')})`);
        builder.queryParams.push(...params);
        builder.paramCount = newParamCount;
        console.log('🔄 Using category-based search with conditions:', conditions);
      }
    } else {
      // Fall back to text search if no category mappings found
      builder.paramCount++;
      const searchTerm = `%${fallbackQuery.trim()}%`;
      builder.whereConditions.push(`(
        p.title ILIKE $${builder.paramCount} OR 
        p.description ILIKE $${builder.paramCount} OR
        p.category ILIKE $${builder.paramCount} OR
        p.subcategory ILIKE $${builder.paramCount} OR
        EXISTS (
          SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
          WHERE enriched_tag ILIKE $${builder.paramCount}
        )
      )`);
      builder.queryParams.push(searchTerm);
      console.log('🔄 Using text-based fallback search');
    }
  }

  // Listing type filter (product vs service)
  if (metadata.listing_type) {
    builder.paramCount++;
    builder.whereConditions.push(`p.listing_type = $${builder.paramCount}`);
    builder.queryParams.push(metadata.listing_type);
  }

  // Price filters
  if (metadata.min_price !== undefined) {
    builder.paramCount++;
    builder.whereConditions.push(`p.price >= $${builder.paramCount}`);
    builder.queryParams.push(metadata.min_price);
  }

  if (metadata.max_price !== undefined) {
    builder.paramCount++;
    builder.whereConditions.push(`p.price <= $${builder.paramCount}`);
    builder.queryParams.push(metadata.max_price);
  }

  // Currency filter
  if (metadata.currency) {
    builder.paramCount++;
    builder.whereConditions.push(`p.currency = $${builder.paramCount}`);
    builder.queryParams.push(metadata.currency);
  }

  // Category filters - make more flexible for generic searches
  if (metadata.category) {
    builder.paramCount++;
    builder.whereConditions.push(`(
      p.category ILIKE $${builder.paramCount} OR
      p.subcategory ILIKE $${builder.paramCount} OR
      EXISTS (
        SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
        WHERE enriched_tag ILIKE $${builder.paramCount}
      )
    )`);
    builder.queryParams.push(`%${metadata.category}%`);
  }

  // Subcategory search - make this optional since enriched tags handle semantic matching
  if (metadata.subcategory) {
    builder.paramCount++;
    // Use OR condition to not be too restrictive
    builder.whereConditions.push(`(
      p.subcategory ILIKE $${builder.paramCount} OR 
      EXISTS (
        SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
        WHERE enriched_tag ILIKE $${builder.paramCount}
      )
    )`);
    builder.queryParams.push(`%${metadata.subcategory}%`);
  }

  if (metadata.subsubcategory) {
    builder.paramCount++;
    builder.whereConditions.push(
      `p.subsubcategory ILIKE $${builder.paramCount}`
    );
    builder.queryParams.push(`%${metadata.subsubcategory}%`);
  }

  // Condition filter removed - not useful for search matching

  // Location filtering is now handled separately via locationService
  // when location_data is provided in the search request

  // Features search in enriched_tags and description
  if (metadata.features && metadata.features.length > 0) {
    const featureConditions: string[] = [];

    metadata.features.forEach((feature) => {
      builder.paramCount++;
      featureConditions.push(`(
        p.description ILIKE $${builder.paramCount} OR
        EXISTS (
          SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
          WHERE enriched_tag ILIKE $${builder.paramCount}
        )
      )`);
      builder.queryParams.push(`%${feature}%`);
    });

    if (featureConditions.length > 0) {
      builder.whereConditions.push(`(${featureConditions.join(" OR ")})`);
    }
  }

  // Service-specific searches (search in enriched_tags and description)
  if (metadata.service_type) {
    builder.paramCount++;
    builder.whereConditions.push(`(
      p.description ILIKE $${builder.paramCount} OR
      EXISTS (
        SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
        WHERE enriched_tag ILIKE $${builder.paramCount}
      )
    )`);
    builder.queryParams.push(`%${metadata.service_type}%`);
  }

  if (metadata.availability) {
    builder.paramCount++;
    builder.whereConditions.push(`(
      p.description ILIKE $${builder.paramCount} OR
      EXISTS (
        SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
        WHERE enriched_tag ILIKE $${builder.paramCount}
      )
    )`);
    builder.queryParams.push(`%${metadata.availability}%`);
  }

  if (metadata.experience_level) {
    builder.paramCount++;
    builder.whereConditions.push(`(
      p.description ILIKE $${builder.paramCount} OR
      EXISTS (
        SELECT 1 FROM unnest(p.enriched_tags) as enriched_tag 
        WHERE enriched_tag ILIKE $${builder.paramCount}
      )
    )`);
    builder.queryParams.push(`%${metadata.experience_level}%`);
  }

  // Negotiable filter
  if (metadata.is_negotiable !== undefined) {
    builder.paramCount++;
    builder.whereConditions.push(`p.is_negotiable = $${builder.paramCount}`);
    builder.queryParams.push(metadata.is_negotiable);
  }

  // Build complete query
  const whereClause =
    builder.whereConditions.length > 0
      ? `WHERE ${builder.whereConditions.join(" AND ")}`
      : "";

  const offset = (page - 1) * limit;
  builder.paramCount++;
  const limitParam = builder.paramCount;
  builder.queryParams.push(limit);

  builder.paramCount++;
  const offsetParam = builder.paramCount;
  builder.queryParams.push(offset);

  const finalQuery = `
    ${builder.baseQuery}
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  // Debug logging
  console.log('🔍 Search Query Debug:');
  console.log('Final Query:', finalQuery);
  console.log('Parameters:', builder.queryParams);
  console.log('Metadata:', metadata);

  // Count query for total results
  const countQuery = `
    SELECT COUNT(*)
    FROM products p
    JOIN users u ON p.seller_id = u.id
    ${whereClause}
  `;

  return {
    query: finalQuery,
    countQuery,
    params: builder.queryParams.slice(0, -2), // Remove limit and offset for count query
    allParams: builder.queryParams,
  };
};

export const executeSearchQuery = async (
  metadata: SearchMetadata,
  page: number = 1,
  limit: number = 20
) => {
  try {
    const { query, countQuery, params, allParams } = buildSearchQuery(
      metadata,
      page,
      limit
    );

    // Execute both queries in parallel
    const [searchResult, countResult] = await Promise.all([
      pool.query(query, allParams),
      pool.query(countQuery, params),
    ]);

    const products = searchResult.rows;
    const total = parseInt(countResult.rows[0].count);

    // Add images to products
    const productsWithImages = await addImagesToProducts(products);

    return {
      products: productsWithImages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error executing search query:", error);
    throw error;
  }
};
