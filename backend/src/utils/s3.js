/**
 * s3.js — Amazon S3 helpers including pre-signed URL generation.
 */

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET || 'educloud-assignments-bucket';

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Generate a pre-signed URL for uploading a file to S3.
 * The client uploads directly to S3 — credentials never leave the server.
 */
async function getUploadPresignedUrl(fileKey, contentType, expiresIn = 300) {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error('Invalid file type. Only PDF and DOCX files are allowed.');
  }
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ContentType: contentType,
    Metadata: { uploadedAt: new Date().toISOString() },
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url, fileKey, expiresIn };
}

/**
 * Generate a pre-signed URL for downloading a file from S3.
 */
async function getDownloadPresignedUrl(fileKey, fileName, expiresIn = 300) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName || fileKey.split('/').pop())}"`,
  });
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url, fileKey, expiresIn };
}

/**
 * Delete a file from S3.
 */
async function deleteFile(fileKey) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
}

/**
 * Generate a unique file key for S3 storage.
 */
function generateFileKey(folder, userId, fileName) {
  const timestamp = Date.now();
  const clean = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${userId}/${timestamp}_${clean}`;
}

module.exports = { getUploadPresignedUrl, getDownloadPresignedUrl, deleteFile, generateFileKey, BUCKET, ALLOWED_TYPES, MAX_SIZE };
