import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { uploadSingle, uploadMultiple, handleUploadError } from '../middleware/upload';
import { validateS3Config } from '../config/s3';
import { 
  uploadToS3, 
  generateSignedUrl, 
  deleteFromS3, 
  generateS3Key, 
  extractS3Key 
} from '../utils/s3';
import {
  ImageUploadRequest,
  SetPreviewImageRequest,
  ImageDeleteRequest,
  ImageReorderRequest,
  ProductImageWithSignedUrl
} from '../models/Image';

const router = Router();

// Validate S3 configuration on module load
if (!validateS3Config()) {
  console.warn('S3 configuration is incomplete. Image upload features will be disabled.');
}

// Upload single image to product
router.post('/upload', uploadSingle, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!validateS3Config()) {
      return res.status(503).json({ error: 'Image upload service is not configured' });
    }

    const { product_id, display_order = 0 }: ImageUploadRequest = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    // Verify product exists
    const productResult = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Generate S3 key and upload
    const s3Key = generateS3Key(file.originalname, product_id);
    const uploadResult = await uploadToS3(file.buffer, s3Key, file.mimetype);

    if (!uploadResult.success) {
      return res.status(500).json({ error: uploadResult.error });
    }

    // Save image record to database
    const imageResult = await pool.query(
      `INSERT INTO product_images 
       (product_id, s3_key, s3_url, original_filename, mime_type, file_size, display_order) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        product_id,
        uploadResult.key,
        uploadResult.location,
        file.originalname,
        file.mimetype,
        file.size,
        display_order
      ]
    );

    const savedImage = imageResult.rows[0];

    // Generate signed URL for immediate access
    const signedUrlResult = await generateSignedUrl(uploadResult.key!);

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: {
        ...savedImage,
        signed_url: signedUrlResult.success ? signedUrlResult.signedUrl : null
      }
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload multiple images to product
router.post('/upload-multiple', uploadMultiple, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!validateS3Config()) {
      return res.status(503).json({ error: 'Image upload service is not configured' });
    }

    const { product_id }: { product_id: string } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    // Verify product exists
    const productResult = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const uploadedImages: ProductImageWithSignedUrl[] = [];
    const errors: string[] = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Generate S3 key and upload
        const s3Key = generateS3Key(file.originalname, product_id);
        const uploadResult = await uploadToS3(file.buffer, s3Key, file.mimetype);

        if (!uploadResult.success) {
          errors.push(`${file.originalname}: ${uploadResult.error}`);
          continue;
        }

        // Save image record to database
        const imageResult = await pool.query(
          `INSERT INTO product_images 
           (product_id, s3_key, s3_url, original_filename, mime_type, file_size, display_order) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING *`,
          [
            product_id,
            uploadResult.key,
            uploadResult.location,
            file.originalname,
            file.mimetype,
            file.size,
            i // Use index as display order
          ]
        );

        const savedImage = imageResult.rows[0];

        // Generate signed URL for immediate access
        const signedUrlResult = await generateSignedUrl(uploadResult.key!);

        uploadedImages.push({
          ...savedImage,
          signed_url: signedUrlResult.success ? signedUrlResult.signedUrl! : ''
        });

      } catch (error: any) {
        errors.push(`${file.originalname}: ${error.message}`);
      }
    }

    res.status(201).json({
      message: `${uploadedImages.length} images uploaded successfully`,
      images: uploadedImages,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Multiple image upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get images for a product with signed URLs
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const imagesResult = await pool.query(
      `SELECT * FROM product_images 
       WHERE product_id = $1 
       ORDER BY display_order ASC, created_at ASC`,
      [productId]
    );

    const images = imagesResult.rows;
    const imagesWithSignedUrls: ProductImageWithSignedUrl[] = [];

    // Generate signed URLs for each image
    for (const image of images) {
      const signedUrlResult = await generateSignedUrl(image.s3_key);
      imagesWithSignedUrls.push({
        ...image,
        signed_url: signedUrlResult.success ? signedUrlResult.signedUrl! : ''
      });
    }

    res.json({
      images: imagesWithSignedUrls,
      total: images.length
    });

  } catch (error) {
    console.error('Get product images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set preview image for product
router.put('/set-preview', async (req: Request, res: Response) => {
  try {
    const { product_id, image_id }: SetPreviewImageRequest = req.body;

    if (!product_id || !image_id) {
      return res.status(400).json({ error: 'product_id and image_id are required' });
    }

    // Verify image belongs to product
    const imageResult = await pool.query(
      'SELECT id FROM product_images WHERE id = $1 AND product_id = $2',
      [image_id, product_id]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found for this product' });
    }

    // Update product preview image
    await pool.query(
      'UPDATE products SET preview_image_id = $1 WHERE id = $2',
      [image_id, product_id]
    );

    res.json({ message: 'Preview image set successfully' });

  } catch (error) {
    console.error('Set preview image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete image
router.delete('/:imageId', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;
    const { product_id }: { product_id: string } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    // Get image details
    const imageResult = await pool.query(
      'SELECT * FROM product_images WHERE id = $1 AND product_id = $2',
      [imageId, product_id]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = imageResult.rows[0];

    // Delete from S3
    const s3Key = extractS3Key(image.s3_url);
    if (s3Key) {
      await deleteFromS3(s3Key);
    }

    // Delete from database
    await pool.query('DELETE FROM product_images WHERE id = $1', [imageId]);

    // Clear preview image if this was the preview
    await pool.query(
      'UPDATE products SET preview_image_id = NULL WHERE id = $1 AND preview_image_id = $2',
      [product_id, imageId]
    );

    res.json({ message: 'Image deleted successfully' });

  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder images
router.put('/reorder', async (req: Request, res: Response) => {
  try {
    const { product_id, image_orders }: ImageReorderRequest = req.body;

    if (!product_id || !image_orders || !Array.isArray(image_orders)) {
      return res.status(400).json({ 
        error: 'product_id and image_orders array are required' 
      });
    }

    // Update display orders in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const order of image_orders) {
        await client.query(
          'UPDATE product_images SET display_order = $1 WHERE id = $2 AND product_id = $3',
          [order.display_order, order.image_id, product_id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ message: 'Images reordered successfully' });

  } catch (error) {
    console.error('Reorder images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;