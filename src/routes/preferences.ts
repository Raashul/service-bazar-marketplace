import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { 
  BuyerPreference, 
  CreateBuyerPreferenceRequest, 
  UpdateBuyerPreferenceRequest,
  BuyerPreferenceResponse 
} from '../models/BuyerPreference';
import { extractBuyerPreferenceMetadata } from '../services/llmService';

const router = Router();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Create a new buyer preference
router.post('/', async (req: Request, res: Response) => {
  try {
    const { preference_text, location_data }: CreateBuyerPreferenceRequest = req.body;
    
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';

    if (!preference_text || preference_text.trim().length === 0) {
      return res.status(400).json({ 
        error: 'preference_text is required and cannot be empty' 
      });
    }

    // Extract metadata using LLM
    console.log('🤖 Extracting metadata for buyer preference:', preference_text);
    const metadata = await extractBuyerPreferenceMetadata(preference_text);
    
    console.log('✅ Extracted metadata:', metadata);

    // Insert into database
    const insertQuery = `
      INSERT INTO buyer_preferences (
        buyer_id, preference_text, extracted_keywords, extracted_category,
        extracted_subcategory, extracted_subsubcategory, min_price, max_price,
        currency, listing_type, location_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      buyer_id,
      preference_text,
      metadata.keywords,
      metadata.category,
      metadata.subcategory,
      metadata.subsubcategory,
      metadata.min_price,
      metadata.max_price,
      metadata.currency,
      metadata.listing_type,
      location_data ? JSON.stringify(location_data) : null
    ];

    const result = await pool.query(insertQuery, values);
    const preference: BuyerPreference = result.rows[0];

    // Format response
    const response: BuyerPreferenceResponse = {
      id: preference.id,
      preference_text: preference.preference_text,
      extracted_keywords: preference.extracted_keywords,
      extracted_category: preference.extracted_category,
      extracted_subcategory: preference.extracted_subcategory,
      extracted_subsubcategory: preference.extracted_subsubcategory,
      min_price: preference.min_price,
      max_price: preference.max_price,
      currency: preference.currency,
      listing_type: preference.listing_type,
      location_data: preference.location_data,
      status: preference.status,
      created_at: preference.created_at,
      updated_at: preference.updated_at,
      match_count: preference.match_count
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Error creating buyer preference:', error);
    
    if (error instanceof Error && error.message.includes('LLM')) {
      return res.status(503).json({ 
        error: 'Unable to process preference text',
        details: 'AI service temporarily unavailable'
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all preferences for a buyer
router.get('/', async (req: Request, res: Response) => {
  try {
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';
    
    const { status, limit = 20, page = 1 } = req.query;
    
    let query = `
      SELECT * FROM buyer_preferences 
      WHERE buyer_id = $1
    `;
    const params: any[] = [buyer_id];
    
    // Add status filter if provided
    if (status && typeof status === 'string') {
      query += ' AND status = $2';
      params.push(status);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY created_at DESC';
    query += ` LIMIT ${Number(limit)} OFFSET ${(Number(page) - 1) * Number(limit)}`;
    
    const result = await pool.query(query, params);
    const preferences: BuyerPreference[] = result.rows;
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM buyer_preferences WHERE buyer_id = $1';
    const countParams = [buyer_id];
    
    if (status && typeof status === 'string') {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    // Format response
    const response = {
      preferences: preferences.map(p => ({
        id: p.id,
        preference_text: p.preference_text,
        extracted_keywords: p.extracted_keywords,
        extracted_category: p.extracted_category,
        extracted_subcategory: p.extracted_subcategory,
        extracted_subsubcategory: p.extracted_subsubcategory,
        min_price: p.min_price,
        max_price: p.max_price,
        currency: p.currency,
        listing_type: p.listing_type,
        location_data: p.location_data,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        match_count: p.match_count
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    };
    
    res.json(response);

  } catch (error) {
    console.error('Error fetching buyer preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a buyer preference
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { preference_text, location_data, status }: UpdateBuyerPreferenceRequest = req.body;
    
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';

    // Check if preference exists and belongs to buyer
    const checkQuery = 'SELECT * FROM buyer_preferences WHERE id = $1 AND buyer_id = $2';
    const checkResult = await pool.query(checkQuery, [id, buyer_id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    let updateFields: string[] = [];
    let updateValues: any[] = [];
    let paramIndex = 1;

    // If preference_text is being updated, re-extract metadata
    let metadata = null;
    if (preference_text && preference_text.trim().length > 0) {
      console.log('🤖 Re-extracting metadata for updated preference:', preference_text);
      metadata = await extractBuyerPreferenceMetadata(preference_text);
      
      updateFields.push(`preference_text = $${paramIndex++}`);
      updateValues.push(preference_text);
      
      updateFields.push(`extracted_keywords = $${paramIndex++}`);
      updateValues.push(metadata.keywords);
      
      updateFields.push(`extracted_category = $${paramIndex++}`);
      updateValues.push(metadata.category);
      
      updateFields.push(`extracted_subcategory = $${paramIndex++}`);
      updateValues.push(metadata.subcategory);
      
      updateFields.push(`extracted_subsubcategory = $${paramIndex++}`);
      updateValues.push(metadata.subsubcategory);
      
      updateFields.push(`min_price = $${paramIndex++}`);
      updateValues.push(metadata.min_price);
      
      updateFields.push(`max_price = $${paramIndex++}`);
      updateValues.push(metadata.max_price);
      
      updateFields.push(`currency = $${paramIndex++}`);
      updateValues.push(metadata.currency);
      
      updateFields.push(`listing_type = $${paramIndex++}`);
      updateValues.push(metadata.listing_type);
    }

    if (location_data !== undefined) {
      updateFields.push(`location_data = $${paramIndex++}`);
      updateValues.push(location_data ? JSON.stringify(location_data) : null);
    }

    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add WHERE clause parameters
    updateValues.push(id, buyer_id);
    
    const updateQuery = `
      UPDATE buyer_preferences 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND buyer_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);
    const preference: BuyerPreference = result.rows[0];

    // Format response
    const response: BuyerPreferenceResponse = {
      id: preference.id,
      preference_text: preference.preference_text,
      extracted_keywords: preference.extracted_keywords,
      extracted_category: preference.extracted_category,
      extracted_subcategory: preference.extracted_subcategory,
      extracted_subsubcategory: preference.extracted_subsubcategory,
      min_price: preference.min_price,
      max_price: preference.max_price,
      currency: preference.currency,
      listing_type: preference.listing_type,
      location_data: preference.location_data,
      status: preference.status,
      created_at: preference.created_at,
      updated_at: preference.updated_at,
      match_count: preference.match_count
    };

    res.json(response);

  } catch (error) {
    console.error('Error updating buyer preference:', error);
    
    if (error instanceof Error && error.message.includes('LLM')) {
      return res.status(503).json({ 
        error: 'Unable to process preference text',
        details: 'AI service temporarily unavailable'
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a buyer preference
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';

    const deleteQuery = 'DELETE FROM buyer_preferences WHERE id = $1 AND buyer_id = $2 RETURNING id';
    const result = await pool.query(deleteQuery, [id, buyer_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    res.json({ message: 'Preference deleted successfully' });

  } catch (error) {
    console.error('Error deleting buyer preference:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;