import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/apiError';

// Configure Cloudinary SDK instance
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret'
});

export class CloudinaryService {
  /**
   * Upload file to Cloudinary inside specified folder structures.
   * Folders: evidence/, reports/, avatars/, documents/
   */
  public static async uploadFile(fileBuffer: Buffer, fileName: string, folderName: string): Promise<{ secure_url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `cib/${folderName}`,
          resource_type: 'auto',
          public_id: fileName.split('.')[0]
        },
        (error, result) => {
          if (error) {
            reject(new ApiError(500, 'Cloudinary file upload stream failed.'));
          } else if (result) {
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id
            });
          }
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete file from Cloudinary using resource public_id.
   */
  public static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      throw new ApiError(500, 'Cloudinary file deletion failed.');
    }
  }

  /**
   * Replace existing file in Cloudinary with a fresh upload.
   */
  public static async replaceFile(oldPublicId: string, newFileBuffer: Buffer, newFileName: string, folderName: string): Promise<{ secure_url: string; public_id: string }> {
    if (oldPublicId) {
      await this.deleteFile(oldPublicId).catch(() => {}); // Catch failures gracefully
    }
    return this.uploadFile(newFileBuffer, newFileName, folderName);
  }
}
export { cloudinary };
