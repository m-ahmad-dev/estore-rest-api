import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../core/configs/s3.config.js';
import env from '../../core/configs/env.js';
import { getCDNUrl } from '../../core/utils/url.utils.js';

export const getUploadPresignedUrl = async (fileName, fileType) => {
  const fileKey = `products/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: env.B2_BUCKET_NAME,
    Key: fileKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    uploadUrl,
    fileKey,
    publicUrl: getCDNUrl(fileKey), // Send final URL to frontend
  };
};

export const deleteObject = async (fileKey) => {
  const command = new DeleteObjectCommand({
    Bucket: env.B2_BUCKET_NAME,
    Key: fileKey,
  });

  return await s3Client.send(command);
};
