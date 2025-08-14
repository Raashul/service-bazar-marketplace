import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Match, MatchResponse, UpdateMatchRequest } from '../models/Match';

const router = Router();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Get all matches for a buyer
router.get('/', async (req: Request, res: Response) => {
  try {
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';
    
    const { status, preference_id, limit = 20, page = 1, sort = 'newest' } = req.query;
    
    let whereConditions = ['m.buyer_id = $1'];
    let queryParams: any[] = [buyer_id];
    let paramIndex = 2;

    // Filter by status if provided
    if (status && typeof status === 'string') {
      whereConditions.push(`m.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Filter by preference if provided
    if (preference_id && typeof preference_id === 'string') {
      whereConditions.push(`m.preference_id = $${paramIndex}`);
      queryParams.push(preference_id);
      paramIndex++;
    }

    // Determine sorting
    let orderBy = 'm.matched_at DESC'; // Default: newest first
    if (sort === 'score') {
      orderBy = 'm.match_score DESC, m.matched_at DESC';
    } else if (sort === 'oldest') {
      orderBy = 'm.matched_at ASC';
    }

    const query = `
      SELECT 
        m.*,
        bp.preference_text,
        CASE WHEN p.id IS NOT NULL AND p.status = 'active' THEN true ELSE false END as is_product_available
      FROM buyer_preference_matches m
      LEFT JOIN buyer_preferences bp ON m.preference_id = bp.id
      LEFT JOIN products p ON m.product_id = p.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${Number(limit)} OFFSET ${(Number(page) - 1) * Number(limit)}
    `;
    
    const result = await pool.query(query, queryParams);
    const matches: any[] = result.rows;
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM buyer_preference_matches m
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);
    
    // Format response
    const response = {
      matches: matches.map(m => ({
        id: m.id,
        preference_id: m.preference_id,
        preference_text: m.preference_text,
        match_score: m.match_score,
        match_reason: m.match_reason,
        product_snapshot: m.product_snapshot,
        status: m.status,
        matched_at: m.matched_at,
        viewed_at: m.viewed_at,
        is_product_available: m.is_product_available
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      filters: {
        status: status || null,
        preference_id: preference_id || null,
        sort: sort
      }
    };
    
    res.json(response);

  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get matches for a specific preference
router.get('/preference/:preference_id', async (req: Request, res: Response) => {
  try {
    const { preference_id } = req.params;
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';
    
    const { limit = 10, page = 1 } = req.query;

    const query = `
      SELECT 
        m.*,
        bp.preference_text,
        CASE WHEN p.id IS NOT NULL AND p.status = 'active' THEN true ELSE false END as is_product_available
      FROM buyer_preference_matches m
      LEFT JOIN buyer_preferences bp ON m.preference_id = bp.id
      LEFT JOIN products p ON m.product_id = p.id
      WHERE m.preference_id = $1 AND m.buyer_id = $2
      ORDER BY m.match_score DESC, m.matched_at DESC
      LIMIT ${Number(limit)} OFFSET ${(Number(page) - 1) * Number(limit)}
    `;
    
    const result = await pool.query(query, [preference_id, buyer_id]);
    const matches: any[] = result.rows;
    
    if (matches.length === 0) {
      return res.status(404).json({ error: 'No matches found for this preference' });
    }

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM buyer_preference_matches WHERE preference_id = $1 AND buyer_id = $2',
      [preference_id, buyer_id]
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Format response
    const response = {
      preference_text: matches[0].preference_text,
      matches: matches.map(m => ({
        id: m.id,
        match_score: m.match_score,
        match_reason: m.match_reason,
        product_snapshot: m.product_snapshot,
        status: m.status,
        matched_at: m.matched_at,
        viewed_at: m.viewed_at,
        is_product_available: m.is_product_available
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    };
    
    res.json(response);

  } catch (error) {
    console.error('Error fetching preference matches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update match status (mark as viewed, interested, contacted, dismissed)
router.put('/:match_id', async (req: Request, res: Response) => {
  try {
    const { match_id } = req.params;
    const { status }: UpdateMatchRequest = req.body;
    
    // For now, using a dummy buyer_id - in real app, get from JWT token  
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';

    if (!status || !['viewed', 'interested', 'contacted', 'dismissed'].includes(status)) {
      return res.status(400).json({ 
        error: 'Valid status required: viewed, interested, contacted, or dismissed' 
      });
    }

    // Check if match exists and belongs to buyer
    const checkQuery = 'SELECT * FROM buyer_preference_matches WHERE id = $1 AND buyer_id = $2';
    const checkResult = await pool.query(checkQuery, [match_id, buyer_id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Update match status
    let updateQuery = 'UPDATE buyer_preference_matches SET status = $1, updated_at = CURRENT_TIMESTAMP';
    let queryParams = [status, match_id, buyer_id];
    
    // Set viewed_at timestamp if marking as viewed for the first time
    if (status === 'viewed' && !checkResult.rows[0].viewed_at) {
      updateQuery += ', viewed_at = CURRENT_TIMESTAMP';
    }
    
    updateQuery += ' WHERE id = $2 AND buyer_id = $3 RETURNING *';
    
    const result = await pool.query(updateQuery, queryParams);
    const updatedMatch = result.rows[0];

    res.json({
      message: 'Match status updated successfully',
      match: {
        id: updatedMatch.id,
        status: updatedMatch.status,
        viewed_at: updatedMatch.viewed_at,
        updated_at: updatedMatch.updated_at
      }
    });

  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get match statistics for buyer
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // For now, using a dummy buyer_id - in real app, get from JWT token
    const buyer_id = '81a561ef-6ffd-4939-8fa8-55eedae0b047';

    const statsQuery = `
      SELECT 
        COUNT(*) as total_matches,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_matches,
        COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed_matches,
        COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested_matches,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_matches,
        COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_matches,
        AVG(match_score) as avg_match_score,
        MAX(match_score) as best_match_score,
        COUNT(CASE WHEN matched_at >= NOW() - INTERVAL '7 days' THEN 1 END) as matches_this_week,
        COUNT(CASE WHEN matched_at >= NOW() - INTERVAL '30 days' THEN 1 END) as matches_this_month
      FROM buyer_preference_matches 
      WHERE buyer_id = $1
    `;

    const result = await pool.query(statsQuery, [buyer_id]);
    const stats = result.rows[0];

    res.json({
      total_matches: parseInt(stats.total_matches),
      by_status: {
        new: parseInt(stats.new_matches),
        viewed: parseInt(stats.viewed_matches), 
        interested: parseInt(stats.interested_matches),
        contacted: parseInt(stats.contacted_matches),
        dismissed: parseInt(stats.dismissed_matches)
      },
      match_quality: {
        avg_score: parseFloat(stats.avg_match_score) || 0,
        best_score: parseInt(stats.best_match_score) || 0
      },
      recent_activity: {
        matches_this_week: parseInt(stats.matches_this_week),
        matches_this_month: parseInt(stats.matches_this_month)
      }
    });

  } catch (error) {
    console.error('Error fetching match statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;