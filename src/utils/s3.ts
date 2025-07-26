import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_CONFIG } from '../config/s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface S3UploadResult {
  success: boolean;
  key?: string;
  location?: string;
  error?: string;
}

export interface S3SignedUrlResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

/**
 * Generate S3 key for uploaded file
 */
export const generateS3Key = (originalName: string, productId: string): string => {
  const timestamp = Date.now();
  const fileExtension = path.extname(originalName);
  const fileName = `${uuidv4()}_${timestamp}${fileExtension}`;
  return `products/${productId}/${fileName}`;
};

/**
 * Upload file buffer to S3
 */
export const uploadToS3 = async (
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<S3UploadResult> => {
  try {
    // Validate MIME type
    if (!S3_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        success: false,
        error: `Invalid file type. Allowed types: ${S3_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`
      };
    }

    // Validate file size
    if (buffer.length > S3_CONFIG.MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large. Maximum size: ${S3_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }

    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    const location = `s3://${S3_CONFIG.BUCKET_NAME}/${key}`;

    return {
      success: true,
      key,
      location,
    };
  } catch (error: any) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file to S3'
    };
  }
};

/**
 * Generate signed URL for S3 object
 */
export const generateSignedUrl = async (key: string): Promise<S3SignedUrlResult> => {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: S3_CONFIG.SIGNED_URL_EXPIRES,
    });

    return {
      success: true,
      signedUrl,
    };
  } catch (error: any) {
    console.error('S3 signed URL generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate signed URL'
    };
  }
};

/**
 * Delete file from S3
 */
export const deleteFromS3 = async (key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    return { success: true };
  } catch (error: any) {
    console.error('S3 delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete file from S3'
    };
  }
};

/**
 * Extract S3 key from S3 URL
 */
export const extractS3Key = (s3Url: string): string | null => {
  try {
    // Handle s3:// URLs
    if (s3Url.startsWith('s3://')) {
      const urlParts = s3Url.replace('s3://', '').split('/');
      urlParts.shift(); // Remove bucket name
      return urlParts.join('/');
    }
    
    // Handle https:// URLs
    if (s3Url.includes('.amazonaws.com/')) {
      const urlParts = s3Url.split('.amazonaws.com/');
      return urlParts[1];
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Validate image file
 */
export const validateImageFile = (file: Express.Multer.File): { valid: boolean; error?: string } => {
  // Check MIME type
  if (!S3_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${S3_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  // Check file size
  if (file.size > S3_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${S3_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return { valid: true };
};