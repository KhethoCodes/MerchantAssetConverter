import { v2 as cloudinary } from 'cloudinary';

// This file is the ONLY place that knows images are stored in Cloudinary.
// Every other file just calls uploadImage(buffer, name) and gets a URL back.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a finished PNG buffer to Cloudinary.
 * @param {Buffer} buffer - the final image bytes
 * @param {string} publicId - a unique name for the file (no extension)
 * @returns {Promise<{ url: string, bytes: number }>}
 */
export function uploadImage(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: 'pinnacle-merchant-images',
        resource_type: 'image',
        format: 'png',
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, bytes: result.bytes });
      }
    );
    stream.end(buffer);
  });
}

/*
  SWAP-OUT NOTE:
  When migrating to AWS S3, replace the body of uploadImage() with an S3 PutObjectCommand
  upload (using @aws-sdk/client-s3), but keep the same function name and the same
  return shape ({ url, bytes }). Nothing in the API routes needs to change — they only
  ever call uploadImage(buffer, publicId).
*/
