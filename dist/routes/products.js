"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const categories_1 = require("../utils/categories");
const productImages_1 = require("../utils/productImages");
const buyerMatchingService_1 = require("../services/buyerMatchingService");
const matchSyncService_1 = require("../services/matchSyncService");
const llmService_1 = require("../services/llmService");
const searchQueryBuilder_1 = require("../utils/searchQueryBuilder");
const llmService_2 = require("../services/llmService");
const contentCleaningService_1 = require("../services/contentCleaningService");
const locationService_1 = __importDefault(require("../services/locationService"));
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const { title, description, price, currency = "USD", category, subcategory = "", subsubcategory = "", condition, location, location_data, // New Mapbox location data
        listing_type = 'product', is_negotiable = true, expires_in_days = 30, } = req.body;
        const seller_id = req.body.seller_id;
        // For services, condition should default to 'new' if not provided
        const finalCondition = listing_type === 'service' && !condition ? 'new' : condition;
        if (!title ||
            !description ||
            !price ||
            !category ||
            (listing_type === 'product' && !condition) ||
            !location ||
            !seller_id) {
            return res.status(400).json({
                error: "Required fields: title, description, price, category, condition, location, seller_id",
            });
        }
        // Validate category hierarchy
        if (!(0, categories_1.validateCategory)(category)) {
            return res.status(400).json({
                error: "Invalid category. Valid categories: Electronics, Vehicles, Books, Service",
            });
        }
        if (subcategory && !(0, categories_1.validateSubcategory)(category, subcategory)) {
            return res.status(400).json({
                error: `Invalid subcategory '${subcategory}' for category '${category}'`,
            });
        }
        if (subsubcategory &&
            !(0, categories_1.validateSubsubcategory)(subcategory, subsubcategory)) {
            return res.status(400).json({
                error: `Invalid subsubcategory '${subsubcategory}' for subcategory '${subcategory}'`,
            });
        }
        if (!["new", "like_new", "good", "fair", "poor"].includes(condition)) {
            return res.status(400).json({
                error: "Invalid condition. Must be: new, like_new, good, fair, or poor",
            });
        }
        const userCheck = await database_1.pool.query("SELECT id FROM users WHERE id = $1", [
            seller_id,
        ]);
        if (userCheck.rows.length === 0) {
            return res.status(400).json({ error: "Invalid seller_id" });
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expires_in_days);
        // Step 1: Process location data
        let locationInfo = null;
        if (location_data) {
            locationInfo = locationService_1.default.validateLocationData(location_data);
            if (!locationInfo) {
                return res.status(400).json({
                    error: "Invalid location data provided"
                });
            }
        }
        // Step 2: Clean title only (preserve description exactly as entered)
        console.log('Cleaning product title...');
        const cleaningResult = await (0, contentCleaningService_1.cleanProductContent)(title, description);
        console.log('Content cleaning result:', {
            method: cleaningResult.method,
            changes: cleaningResult.changes.changesApplied,
            cost_saved: cleaningResult.cost_saved
        });
        // Use cleaned title but preserve original description
        const finalTitle = cleaningResult.cleaned.title;
        const finalDescription = description; // Preserve original description formatting
        // Step 3: Generate enriched tags using cleaned title and original description
        console.log('Generating enriched tags for product...');
        const enrichedTags = await (0, llmService_2.extractEnrichedTags)(finalTitle, finalDescription, price);
        console.log('Generated enriched tags:', enrichedTags);
        const result = await database_1.pool.query(`
      INSERT INTO products 
      (seller_id, title, description, price, currency, category, subcategory, subsubcategory, condition, location, listing_type, enriched_tags, is_negotiable, expires_at, 
       mapbox_id, full_address, latitude, longitude, place_name, district, region, country, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
      RETURNING *
    `, [
            seller_id,
            finalTitle,
            finalDescription,
            price,
            currency,
            category,
            subcategory,
            subsubcategory,
            finalCondition,
            location,
            listing_type,
            enrichedTags,
            is_negotiable,
            expiresAt,
            // Location fields
            locationInfo?.mapbox_id || null,
            locationInfo?.full_address || null,
            locationInfo?.latitude || null,
            locationInfo?.longitude || null,
            locationInfo?.place_name || null,
            locationInfo?.district || null,
            locationInfo?.region || null,
            locationInfo?.country || null,
        ]);
        const product = result.rows[0];
        // Step 4: Process buyer preference matching (fire and forget)
        console.log('🎯 Checking for buyer preference matches...');
        (0, buyerMatchingService_1.processMatches)(product).catch(error => {
            console.error('Error in buyer matching process:', error);
            // Don't fail the product creation if matching fails
        });
        res.status(201).json({
            message: "Product created successfully",
            product,
            content_cleaning: {
                title_changes_applied: cleaningResult.changes.changesApplied,
                method: cleaningResult.method,
                original_title: cleaningResult.original.title,
                description_preserved: true, // Description formatting preserved exactly as entered
                note: "Description preserved with original formatting (emojis, paragraphs, etc.)"
            },
            location_info: locationInfo ? {
                place_name: locationInfo.place_name,
                full_address: locationInfo.full_address,
                coordinates: [locationInfo.longitude, locationInfo.latitude],
                district: locationInfo.district,
                region: locationInfo.region
            } : null
        });
    }
    catch (error) {
        console.error("Create product error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/categories", async (req, res) => {
    try {
        const hierarchy = (0, categories_1.getCategoryHierarchy)();
        res.json({
            message: "Category hierarchy retrieved successfully",
            categories: hierarchy,
        });
    }
    catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/", async (req, res) => {
    try {
        const { category, subcategory, subsubcategory, min_price, max_price, condition, location, search, status = "active", page = 1, limit = 20, } = req.query;
        let query = `
      SELECT p.*, u.name as seller_name, u.phone as seller_phone 
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.status = $1 AND p.expires_at > NOW()
    `;
        const queryParams = [status];
        let paramCount = 1;
        if (category) {
            paramCount++;
            query += ` AND p.category = $${paramCount}`;
            queryParams.push(category);
        }
        if (subcategory) {
            paramCount++;
            query += ` AND p.subcategory = $${paramCount}`;
            queryParams.push(subcategory);
        }
        if (subsubcategory) {
            paramCount++;
            query += ` AND p.subsubcategory = $${paramCount}`;
            queryParams.push(subsubcategory);
        }
        if (min_price) {
            paramCount++;
            query += ` AND p.price >= $${paramCount}`;
            queryParams.push(min_price);
        }
        if (max_price) {
            paramCount++;
            query += ` AND p.price <= $${paramCount}`;
            queryParams.push(max_price);
        }
        if (condition) {
            paramCount++;
            query += ` AND p.condition = $${paramCount}`;
            queryParams.push(condition);
        }
        if (location) {
            paramCount++;
            query += ` AND p.location ILIKE $${paramCount}`;
            queryParams.push(`%${location}%`);
        }
        if (search) {
            paramCount++;
            query += ` AND (p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
        }
        query += ` ORDER BY p.created_at DESC`;
        const offset = (Number(page) - 1) * Number(limit);
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        queryParams.push(Number(limit));
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        queryParams.push(offset);
        const result = await database_1.pool.query(query, queryParams);
        const countQuery = `
      SELECT COUNT(*) as total 
      FROM products p 
      WHERE p.status = 'active' AND p.expires_at > NOW()
    `;
        const countResult = await database_1.pool.query(countQuery);
        // Add images to products
        const productsWithImages = await (0, productImages_1.addImagesToProducts)(result.rows);
        res.json({
            products: productsWithImages,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(countResult.rows[0].total),
                totalPages: Math.ceil(Number(countResult.rows[0].total) / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.pool.query(`
      SELECT p.*, u.name as seller_name, u.phone as seller_phone, u.email as seller_email
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = $1
    `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        // Add images to product
        const productWithImages = await (0, productImages_1.addImagesToProduct)(result.rows[0]);
        res.json({ product: productWithImages });
    }
    catch (error) {
        console.error("Get product error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price, currency, category, subcategory, subsubcategory, condition, location, is_negotiable, expires_in_days, } = req.body;
        const seller_id = req.body.seller_id;
        if (!seller_id) {
            return res.status(400).json({ error: "seller_id is required" });
        }
        const productCheck = await database_1.pool.query("SELECT seller_id, category, subcategory, subsubcategory FROM products WHERE id = $1", [id]);
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        if (productCheck.rows[0].seller_id !== seller_id) {
            return res
                .status(403)
                .json({ error: "Not authorized to update this product" });
        }
        const updateFields = [];
        const updateValues = [];
        let paramCount = 0;
        if (title !== undefined) {
            paramCount++;
            updateFields.push(`title = $${paramCount}`);
            updateValues.push(title);
        }
        if (description !== undefined) {
            paramCount++;
            updateFields.push(`description = $${paramCount}`);
            updateValues.push(description);
        }
        if (price !== undefined) {
            paramCount++;
            updateFields.push(`price = $${paramCount}`);
            updateValues.push(price);
        }
        if (currency !== undefined) {
            paramCount++;
            updateFields.push(`currency = $${paramCount}`);
            updateValues.push(currency);
        }
        if (category !== undefined) {
            if (!(0, categories_1.validateCategory)(category)) {
                return res.status(400).json({
                    error: "Invalid category. Valid categories: Electronics, Vehicles, Books, Service",
                });
            }
            paramCount++;
            updateFields.push(`category = $${paramCount}`);
            updateValues.push(category);
        }
        if (subcategory !== undefined) {
            // For update, we need to validate against the category (either new or existing)
            const currentCategory = category || productCheck.rows[0].category;
            if (subcategory && !(0, categories_1.validateSubcategory)(currentCategory, subcategory)) {
                return res.status(400).json({
                    error: `Invalid subcategory '${subcategory}' for category '${currentCategory}'`,
                });
            }
            paramCount++;
            updateFields.push(`subcategory = $${paramCount}`);
            updateValues.push(subcategory);
        }
        if (subsubcategory !== undefined) {
            // For update, we need to validate against the subcategory (either new or existing)
            const currentSubcategory = subcategory || productCheck.rows[0].subcategory;
            if (subsubcategory &&
                !(0, categories_1.validateSubsubcategory)(currentSubcategory, subsubcategory)) {
                return res.status(400).json({
                    error: `Invalid subsubcategory '${subsubcategory}' for subcategory '${currentSubcategory}'`,
                });
            }
            paramCount++;
            updateFields.push(`subsubcategory = $${paramCount}`);
            updateValues.push(subsubcategory);
        }
        if (condition !== undefined) {
            if (!["new", "like_new", "good", "fair", "poor"].includes(condition)) {
                return res.status(400).json({
                    error: "Invalid condition. Must be: new, like_new, good, fair, or poor",
                });
            }
            paramCount++;
            updateFields.push(`condition = $${paramCount}`);
            updateValues.push(condition);
        }
        if (location !== undefined) {
            paramCount++;
            updateFields.push(`location = $${paramCount}`);
            updateValues.push(location);
        }
        if (is_negotiable !== undefined) {
            paramCount++;
            updateFields.push(`is_negotiable = $${paramCount}`);
            updateValues.push(is_negotiable);
        }
        if (expires_in_days !== undefined) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expires_in_days);
            paramCount++;
            updateFields.push(`expires_at = $${paramCount}`);
            updateValues.push(expiresAt);
        }
        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        paramCount++;
        updateFields.push(`updated_at = $${paramCount}`);
        updateValues.push(new Date());
        paramCount++;
        updateValues.push(id);
        const query = `
      UPDATE products 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;
        const result = await database_1.pool.query(query, updateValues);
        res.json({
            message: "Product updated successfully",
            product: result.rows[0],
        });
    }
    catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { seller_id } = req.body;
        if (!seller_id) {
            return res.status(400).json({ error: "seller_id is required" });
        }
        const productCheck = await database_1.pool.query("SELECT seller_id FROM products WHERE id = $1", [id]);
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        if (productCheck.rows[0].seller_id !== seller_id) {
            return res
                .status(403)
                .json({ error: "Not authorized to delete this product" });
        }
        await database_1.pool.query("UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2", ["removed", id]);
        res.json({ message: "Product deleted successfully" });
    }
    catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Natural Language Search endpoint with optional Mapbox location
router.post("/search/natural", async (req, res) => {
    try {
        const { query, location_data, limit = 20, page = 1 } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Search query is required" });
        }
        if (typeof query !== 'string' || query.trim().length === 0) {
            return res.status(400).json({ error: "Query must be a non-empty string" });
        }
        // Validate location data if provided
        let locationInfo = null;
        if (location_data) {
            locationInfo = locationService_1.default.validateLocationData(location_data);
            if (!locationInfo) {
                return res.status(400).json({
                    error: "Invalid location data provided"
                });
            }
        }
        // Extract metadata using LLM (no location extraction)
        console.log(`🔍 Extracting metadata from query: "${query}"`);
        const extractedMetadata = await (0, llmService_1.extractSearchMetadata)(query);
        console.log('🔍 Extracted metadata:', JSON.stringify(extractedMetadata, null, 2));
        let searchResults;
        let searchCenter;
        // Check if location data was provided by user
        if (locationInfo) {
            console.log(`🌍 Location-based search for: ${locationInfo.place_name}`);
            // Perform location-based search using provided Mapbox data
            const products = await locationService_1.default.searchProductsWithinRadius(locationInfo.latitude, locationInfo.longitude, 3, // 3km default radius
            {
                keywords: extractedMetadata.keywords,
                listing_type: extractedMetadata.listing_type,
                min_price: extractedMetadata.min_price,
                max_price: extractedMetadata.max_price,
                page,
                limit
            });
            const total = await locationService_1.default.getLocationSearchCount(locationInfo.latitude, locationInfo.longitude, 3, {
                keywords: extractedMetadata.keywords,
                listing_type: extractedMetadata.listing_type,
                min_price: extractedMetadata.min_price,
                max_price: extractedMetadata.max_price
            });
            searchResults = {
                products: await (0, productImages_1.addImagesToProducts)(products),
                total,
                page,
                limit
            };
            searchCenter = {
                location: locationInfo.place_name,
                coordinates: [locationInfo.longitude, locationInfo.latitude],
                search_radius_km: 3
            };
            console.log(`🌍 Found ${total} results within 3km of ${locationInfo.place_name}`);
        }
        else {
            // Regular search without location
            console.log('🔍 Regular search without location');
            searchResults = await (0, searchQueryBuilder_1.executeSearchQuery)(extractedMetadata, page, limit);
        }
        // Simplified response with only products and pagination
        res.json({
            products: searchResults.products,
            total: searchResults.total,
            page: searchResults.page,
            limit: searchResults.limit,
            totalPages: Math.ceil(searchResults.total / searchResults.limit)
        });
    }
    catch (error) {
        console.error("Natural language search error:", error);
        // Check if it's an LLM API error
        if (error instanceof Error && error.message.includes('API')) {
            return res.status(503).json({
                error: "Search service temporarily unavailable",
                details: "LLM service error"
            });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
// Generate enriched tags for a listing
router.post("/enrich-tags", async (req, res) => {
    try {
        const { title, description, price } = req.body;
        if (!title || !description || price === undefined) {
            return res.status(400).json({
                error: "title, description, and price are required"
            });
        }
        if (typeof title !== 'string' || typeof description !== 'string') {
            return res.status(400).json({
                error: "title and description must be strings"
            });
        }
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({
                error: "price must be a positive number"
            });
        }
        // Generate enriched tags using LLM
        console.log(`Generating enriched tags for: "${title}"`);
        const enrichedTags = await (0, llmService_2.extractEnrichedTags)(title, description, price);
        res.json({
            enriched_tags: enrichedTags,
            count: enrichedTags.length
        });
    }
    catch (error) {
        console.error("Tag enrichment error:", error);
        // Check if it's an LLM API error
        if (error instanceof Error && error.message.includes('API')) {
            return res.status(503).json({
                error: "Tag enrichment service temporarily unavailable",
                details: "LLM service error"
            });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
// Preview what title cleaning would do (description is preserved as-is)
router.post("/preview-cleaning", async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title) {
            return res.status(400).json({
                error: "title is required"
            });
        }
        if (typeof title !== 'string') {
            return res.status(400).json({
                error: "title must be a string"
            });
        }
        // Description is optional for preview
        const descriptionForPreview = description || "";
        const preview = (0, contentCleaningService_1.getCleaningPreview)(title, descriptionForPreview);
        res.json({
            preview: {
                ...preview,
                note: "Only title will be cleaned. Description preserved exactly as entered."
            },
            content: {
                title: title.substring(0, 100) + (title.length > 100 ? '...' : ''),
                description_note: "Description will be preserved with original formatting (emojis, paragraphs, etc.)"
            }
        });
    }
    catch (error) {
        console.error("Title cleaning preview error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Clean content manually (useful for testing or seller tools) - now only cleans titles
router.post("/clean-content", async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title) {
            return res.status(400).json({
                error: "title is required"
            });
        }
        if (typeof title !== 'string') {
            return res.status(400).json({
                error: "title must be a string"
            });
        }
        if (title.length > 500) {
            return res.status(400).json({
                error: "title too long (max 500 characters)"
            });
        }
        // Description is optional and will be preserved as-is if provided
        const preservedDescription = description || "";
        console.log(`Manual title cleaning requested for: "${title.substring(0, 50)}..."`);
        const cleaningResult = await (0, contentCleaningService_1.cleanProductContent)(title, preservedDescription);
        res.json({
            success: true,
            result: {
                ...cleaningResult,
                note: "Only title is cleaned. Description preserved exactly as entered."
            },
            cost_estimate: cleaningResult.cost_saved ? 0 : 0.001 // rough estimate
        });
    }
    catch (error) {
        console.error("Manual title cleaning error:", error);
        // Check if it's an LLM API error
        if (error instanceof Error && error.message.includes('API')) {
            return res.status(503).json({
                error: "Title cleaning service temporarily unavailable",
                details: "LLM service error"
            });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
// Debug endpoint to test search queries directly
router.post("/debug-search", async (req, res) => {
    try {
        const { testQuery } = req.body;
        if (!testQuery) {
            return res.status(400).json({ error: "testQuery is required" });
        }
        console.log('🔧 Debug: Testing direct SQL query');
        console.log('Query:', testQuery);
        const result = await database_1.pool.query(testQuery);
        res.json({
            success: true,
            rowCount: result.rows.length,
            rows: result.rows
        });
    }
    catch (error) {
        console.error("Debug search error:", error);
        res.status(500).json({
            error: "Query failed",
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Update product status (mark as sold, expired, removed)
router.put("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        // Validate status
        if (!status || !['active', 'sold', 'expired', 'removed'].includes(status)) {
            return res.status(400).json({
                error: 'Valid status required: active, sold, expired, or removed'
            });
        }
        // Check if product exists
        const checkQuery = 'SELECT id, status, seller_id, title FROM products WHERE id = $1';
        const checkResult = await database_1.pool.query(checkQuery, [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const product = checkResult.rows[0];
        const oldStatus = product.status;
        // Only update if status actually changed
        if (oldStatus === status) {
            return res.json({
                message: 'Product status unchanged',
                product: { id, status, title: product.title }
            });
        }
        console.log(`📊 Updating product ${id} status: ${oldStatus} → ${status}`);
        // Update product status
        const updateQuery = `
      UPDATE products 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `;
        const updateResult = await database_1.pool.query(updateQuery, [status, id]);
        const updatedProduct = updateResult.rows[0];
        // Update related matches asynchronously
        (0, matchSyncService_1.updateRelatedMatches)(id, status, reason).catch(error => {
            console.error('Error updating related matches:', error);
        });
        res.json({
            message: 'Product status updated successfully',
            product: {
                id: updatedProduct.id,
                title: updatedProduct.title,
                status: updatedProduct.status,
                previous_status: oldStatus,
                updated_at: updatedProduct.updated_at
            }
        });
    }
    catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map