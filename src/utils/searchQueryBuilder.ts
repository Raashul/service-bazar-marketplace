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
  // When keywords are present, use them for search and skip restrictive category/subcategory filters
  let hasKeywordSearch = false;

  if (metadata.keywords && metadata.keywords.length > 0) {
    hasKeywordSearch = true;
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
    hasKeywordSearch = true;
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

  // Currency filter - disabled as it's too restrictive
  // LLM defaults to USD which would filter out products with other currencies
  // if (metadata.currency) {
  //   builder.paramCount++;
  //   builder.whereConditions.push(`p.currency = $${builder.paramCount}`);
  //   builder.queryParams.push(metadata.currency);
  // }

  // Skip category/subcategory/features filters when keywords are present
  // Keywords already search in category, subcategory, and enriched_tags
  // Adding these as additional AND conditions makes the search too restrictive
  if (!hasKeywordSearch) {
    // Category filters - only apply when no keyword search
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

    // Subcategory search - only apply when no keyword search
    if (metadata.subcategory) {
      builder.paramCount++;
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

    // Features search - only apply when no keyword search
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
  }

  // Condition filter removed - not useful for search matching

  // Location filtering is now handled separately via locationService
  // when location_data is provided in the search request

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
  limit: number = 20,
  fallbackQuery?: string
) => {
  try {
    const { query, countQuery, params, allParams } = buildSearchQuery(
      metadata,
      page,
      limit,
      fallbackQuery
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

/**
 * Search for exact brand/model matches in product titles
 * Used when user searches for specific brands like "Mercedes", "iPhone 16 Pro"
 */
export const executeBrandMatchSearch = async (
  brands: string[],
  model: string | undefined,
  metadata: SearchMetadata,
  page: number = 1,
  limit: number = 20
) => {
  try {
    if (brands.length === 0 && !model) {
      return { products: [], total: 0, page, limit, totalPages: 0 };
    }

    const queryParams: any[] = ["active"];
    let paramCount = 1;

    // Build brand/model conditions - search in title
    const brandConditions: string[] = [];

    // Add brand conditions
    for (const brand of brands) {
      paramCount++;
      brandConditions.push(`p.title ILIKE $${paramCount}`);
      queryParams.push(`%${brand}%`);
    }

    // Add model condition if present
    if (model) {
      paramCount++;
      brandConditions.push(`p.title ILIKE $${paramCount}`);
      queryParams.push(`%${model}%`);
    }

    const brandClause = brandConditions.length > 0
      ? `AND (${brandConditions.join(" OR ")})`
      : "";

    // Add price filters if present
    let priceClause = "";
    if (metadata.min_price !== undefined) {
      paramCount++;
      priceClause += ` AND p.price >= $${paramCount}`;
      queryParams.push(metadata.min_price);
    }
    if (metadata.max_price !== undefined) {
      paramCount++;
      priceClause += ` AND p.price <= $${paramCount}`;
      queryParams.push(metadata.max_price);
    }

    // Add listing type filter if present
    let listingTypeClause = "";
    if (metadata.listing_type) {
      paramCount++;
      listingTypeClause = ` AND p.listing_type = $${paramCount}`;
      queryParams.push(metadata.listing_type);
    }

    const offset = (page - 1) * limit;
    paramCount++;
    const limitParam = paramCount;
    queryParams.push(limit);
    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(offset);

    const searchQuery = `
      SELECT p.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone
      FROM products p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = $1
        AND p.expires_at > NOW()
        ${brandClause}
        ${priceClause}
        ${listingTypeClause}
      ORDER BY p.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM products p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = $1
        AND p.expires_at > NOW()
        ${brandClause}
        ${priceClause}
        ${listingTypeClause}
    `;

    console.log("🎯 Brand match search query:", searchQuery);
    console.log("🎯 Brand match params:", queryParams);

    const [searchResult, countResult] = await Promise.all([
      pool.query(searchQuery, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)),
    ]);

    const products = searchResult.rows;
    const total = parseInt(countResult.rows[0].count);
    const productsWithImages = await addImagesToProducts(products);

    return {
      products: productsWithImages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error executing brand match search:", error);
    throw error;
  }
};

/**
 * Search for related products (same category but different brand)
 * Excludes products that already matched the brand search
 */
export const executeRelatedSearch = async (
  brands: string[],
  model: string | undefined,
  metadata: SearchMetadata,
  matchedProductIds: string[],
  page: number = 1,
  limit: number = 20
) => {
  try {
    const queryParams: any[] = ["active"];
    let paramCount = 1;

    // Exclude already matched products
    let excludeClause = "";
    if (matchedProductIds.length > 0) {
      paramCount++;
      excludeClause = ` AND p.id != ALL($${paramCount})`;
      queryParams.push(matchedProductIds);
    }

    // Exclude products that match the brand/model in title (to avoid duplicates)
    const excludeBrandConditions: string[] = [];
    for (const brand of brands) {
      paramCount++;
      excludeBrandConditions.push(`p.title ILIKE $${paramCount}`);
      queryParams.push(`%${brand}%`);
    }
    if (model) {
      paramCount++;
      excludeBrandConditions.push(`p.title ILIKE $${paramCount}`);
      queryParams.push(`%${model}%`);
    }
    const excludeBrandClause = excludeBrandConditions.length > 0
      ? `AND NOT (${excludeBrandConditions.join(" OR ")})`
      : "";

    // Add category filter to find related products
    let categoryClause = "";
    if (metadata.category) {
      paramCount++;
      categoryClause = ` AND (p.category ILIKE $${paramCount} OR p.subcategory ILIKE $${paramCount})`;
      queryParams.push(`%${metadata.category}%`);
    }

    // Add price filters if present
    let priceClause = "";
    if (metadata.min_price !== undefined) {
      paramCount++;
      priceClause += ` AND p.price >= $${paramCount}`;
      queryParams.push(metadata.min_price);
    }
    if (metadata.max_price !== undefined) {
      paramCount++;
      priceClause += ` AND p.price <= $${paramCount}`;
      queryParams.push(metadata.max_price);
    }

    // Add listing type filter if present
    let listingTypeClause = "";
    if (metadata.listing_type) {
      paramCount++;
      listingTypeClause = ` AND p.listing_type = $${paramCount}`;
      queryParams.push(metadata.listing_type);
    }

    const offset = (page - 1) * limit;
    paramCount++;
    const limitParam = paramCount;
    queryParams.push(limit);
    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(offset);

    const searchQuery = `
      SELECT p.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone
      FROM products p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = $1
        AND p.expires_at > NOW()
        ${excludeClause}
        ${excludeBrandClause}
        ${categoryClause}
        ${priceClause}
        ${listingTypeClause}
      ORDER BY p.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM products p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = $1
        AND p.expires_at > NOW()
        ${excludeClause}
        ${excludeBrandClause}
        ${categoryClause}
        ${priceClause}
        ${listingTypeClause}
    `;

    console.log("🔗 Related search query:", searchQuery);
    console.log("🔗 Related search params:", queryParams);

    const [searchResult, countResult] = await Promise.all([
      pool.query(searchQuery, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)),
    ]);

    const products = searchResult.rows;
    const total = parseInt(countResult.rows[0].count);
    const productsWithImages = await addImagesToProducts(products);

    return {
      products: productsWithImages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error executing related search:", error);
    throw error;
  }
};
