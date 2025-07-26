import { pool } from '../config/database';
import { generateSignedUrl } from './s3';
import { ProductWithImages } from '../models/Product';

export interface ProductImageData {
  id: string;
  original_filename: string;
  signed_url: string;
  display_order: number;
  is_preview: boolean;
}

/**
 * Fetch product images with signed URLs
 */
export const getProductImages = async (productId: string, previewImageId?: string): Promise<ProductImageData[]> => {
  try {
    const imagesResult = await pool.query(
      `SELECT id, s3_key, s3_url, original_filename, display_order
       FROM product_images 
       WHERE product_id = $1 
       ORDER BY display_order ASC, created_at ASC`,
      [productId]
    );

    const images: ProductImageData[] = [];

    for (const image of imagesResult.rows) {
      const signedUrlResult = await generateSignedUrl(image.s3_key);
      
      images.push({
        id: image.id,
        original_filename: image.original_filename,
        signed_url: signedUrlResult.success ? signedUrlResult.signedUrl! : '',
        display_order: image.display_order,
        is_preview: image.id === previewImageId
      });
    }

    return images;
  } catch (error) {
    console.error('Error fetching product images:', error);
    return [];
  }
};

/**
 * Add images to product data
 */
export const addImagesToProduct = async (product: any): Promise<ProductWithImages> => {
  const images = await getProductImages(product.id, product.preview_image_id);
  
  return {
    ...product,
    product_images: images
  };
};

/**
 * Add images to multiple products
 */
export const addImagesToProducts = async (products: any[]): Promise<ProductWithImages[]> => {
  const productsWithImages: ProductWithImages[] = [];
  
  for (const product of products) {
    const productWithImages = await addImagesToProduct(product);
    productsWithImages.push(productWithImages);
  }
  
  return productsWithImages;
};