import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import {
  CreateProductRequest,
  UpdateProductRequest,
  ProductSearchQuery,
} from "../models/Product";
import {
  validateCategory,
  validateSubcategory,
  validateSubsubcategory,
  getCategoryHierarchy,
} from "../utils/categories";
import { addImagesToProduct, addImagesToProducts } from "../utils/productImages";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      price,
      currency = "USD",
      category,
      subcategory = "",
      subsubcategory = "",
      condition,
      location,
      tags = [],
      is_negotiable = true,
      expires_in_days = 30,
    }: CreateProductRequest & { seller_id: string } = req.body;

    const seller_id = req.body.seller_id;

    if (
      !title ||
      !description ||
      !price ||
      !category ||
      !condition ||
      !location ||
      !seller_id
    ) {
      return res.status(400).json({
        error:
          "Required fields: title, description, price, category, condition, location, seller_id",
      });
    }

    // Validate category hierarchy
    if (!validateCategory(category)) {
      return res.status(400).json({
        error:
          "Invalid category. Valid categories: Electronics, Vehicles, Books, Service",
      });
    }

    if (subcategory && !validateSubcategory(category, subcategory)) {
      return res.status(400).json({
        error: `Invalid subcategory '${subcategory}' for category '${category}'`,
      });
    }

    if (
      subsubcategory &&
      !validateSubsubcategory(subcategory, subsubcategory)
    ) {
      return res.status(400).json({
        error: `Invalid subsubcategory '${subsubcategory}' for subcategory '${subcategory}'`,
      });
    }

    if (!["new", "like_new", "good", "fair", "poor"].includes(condition)) {
      return res.status(400).json({
        error: "Invalid condition. Must be: new, like_new, good, fair, or poor",
      });
    }

    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [
      seller_id,
    ]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: "Invalid seller_id" });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const result = await pool.query(
      `
      INSERT INTO products 
      (seller_id, title, description, price, currency, category, subcategory, subsubcategory, condition, location, tags, is_negotiable, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *
    `,
      [
        seller_id,
        title,
        description,
        price,
        currency,
        category,
        subcategory,
        subsubcategory,
        condition,
        location,
        tags,
        is_negotiable,
        expiresAt,
      ]
    );

    const product = result.rows[0];
    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const hierarchy = getCategoryHierarchy();
    res.json({
      message: "Category hierarchy retrieved successfully",
      categories: hierarchy,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      category,
      subcategory,
      subsubcategory,
      min_price,
      max_price,
      condition,
      location,
      search,
      tags,
      status = "active",
      page = 1,
      limit = 20,
    }: ProductSearchQuery = req.query as any;

    let query = `
      SELECT p.*, u.name as seller_name, u.phone as seller_phone 
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.status = $1 AND p.expires_at > NOW()
    `;
    const queryParams: any[] = [status];
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

    if (tags) {
      paramCount++;
      query += ` AND $${paramCount} = ANY(p.tags)`;
      queryParams.push(tags);
    }

    query += ` ORDER BY p.created_at DESC`;

    const offset = (Number(page) - 1) * Number(limit);
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(Number(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(offset);

    const result = await pool.query(query, queryParams);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM products p 
      WHERE p.status = 'active' AND p.expires_at > NOW()
    `;
    const countResult = await pool.query(countQuery);

    // Add images to products
    const productsWithImages = await addImagesToProducts(result.rows);

    res.json({
      products: productsWithImages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(countResult.rows[0].total),
        totalPages: Math.ceil(
          Number(countResult.rows[0].total) / Number(limit)
        ),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT p.*, u.name as seller_name, u.phone as seller_phone, u.email as seller_email
      FROM products p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Add images to product
    const productWithImages = await addImagesToProduct(result.rows[0]);

    res.json({ product: productWithImages });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      currency,
      category,
      subcategory,
      subsubcategory,
      condition,
      location,
      tags,
      is_negotiable,
      expires_in_days,
    }: UpdateProductRequest & { seller_id: number } = req.body;

    const seller_id = req.body.seller_id;

    if (!seller_id) {
      return res.status(400).json({ error: "seller_id is required" });
    }

    const productCheck = await pool.query(
      "SELECT seller_id, category, subcategory, subsubcategory FROM products WHERE id = $1",
      [id]
    );

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
      if (!validateCategory(category)) {
        return res.status(400).json({
          error:
            "Invalid category. Valid categories: Electronics, Vehicles, Books, Service",
        });
      }
      paramCount++;
      updateFields.push(`category = $${paramCount}`);
      updateValues.push(category);
    }
    if (subcategory !== undefined) {
      // For update, we need to validate against the category (either new or existing)
      const currentCategory = category || productCheck.rows[0].category;
      if (subcategory && !validateSubcategory(currentCategory, subcategory)) {
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
      const currentSubcategory =
        subcategory || productCheck.rows[0].subcategory;
      if (
        subsubcategory &&
        !validateSubsubcategory(currentSubcategory, subsubcategory)
      ) {
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
          error:
            "Invalid condition. Must be: new, like_new, good, fair, or poor",
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
    if (tags !== undefined) {
      paramCount++;
      updateFields.push(`tags = $${paramCount}`);
      updateValues.push(tags);
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

    const result = await pool.query(query, updateValues);

    res.json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { seller_id } = req.body;

    if (!seller_id) {
      return res.status(400).json({ error: "seller_id is required" });
    }

    const productCheck = await pool.query(
      "SELECT seller_id FROM products WHERE id = $1",
      [id]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (productCheck.rows[0].seller_id !== seller_id) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this product" });
    }

    await pool.query(
      "UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2",
      ["removed", id]
    );

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
