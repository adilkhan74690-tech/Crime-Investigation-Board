import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/apiError';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret'
});

export class CloudinaryService {
  /**
   * Upload file buffer stream to Cloudinary.
   */
  public static async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    folderName: string
  ): Promise<{ secure_url: string; public_id: string; resource_type: string; format: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `cib/${folderName}`,
          resource_type: 'auto',
          public_id: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary stream upload error:', error);
            reject(new ApiError(500, 'Cloudinary file upload stream failed.'));
          } else if (result) {
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              resource_type: result.resource_type || 'image',
              format: result.format || fileName.split('.').pop() || 'raw'
            });
          }
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete file from Cloudinary using public_id.
   */
  public static async deleteFile(publicId: string): Promise<void> {
    try {
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { invalidate: true });
      }
    } catch (err) {
      console.error('Cloudinary file destroy error:', err);
    }
  }

  /**
   * Replace existing file in Cloudinary.
   */
  public static async replaceFile(
    oldPublicId: string,
    newFileBuffer: Buffer,
    newFileName: string,
    folderName: string
  ): Promise<{ secure_url: string; public_id: string; resource_type: string; format: string }> {
    if (oldPublicId) {
      await this.deleteFile(oldPublicId).catch(() => {});
    }
    return this.uploadFile(newFileBuffer, newFileName, folderName);
  }
}

export { cloudinary };
