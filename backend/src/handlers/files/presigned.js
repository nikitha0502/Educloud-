/**
 * Lambda: POST /files/upload-url    — generate S3 upload pre-signed URL
 *         POST /files/download-url  — generate S3 download pre-signed URL
 */

const { v4: uuidv4 } = require('uuid');
const { getUploadPresignedUrl, getDownloadPresignedUrl, generateFileKey } = require('../../utils/s3');
const { success, badRequest, forbidden, serverError, cors, parseBody, getUserFromEvent } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const caller = getUserFromEvent(event);
    if (!caller) return forbidden('Authentication required.');

    const path   = event.path || event.resource;
    const body   = parseBody(event);

    // ── Upload URL ─────────────────────────────────────────────────────────
    if (path.endsWith('/upload-url')) {
      if (caller.role !== 'student' && caller.role !== 'faculty') {
        return forbidden('Access denied.');
      }

      const { fileName, contentType } = body;
      if (!fileName) return badRequest('fileName is required.');
      if (!contentType) return badRequest('contentType is required.');

      const folder = caller.role === 'student' ? 'submissions' : 'assignment_docs';
      const fileKey = generateFileKey(folder, caller.userId, fileName);

      const { url, expiresIn } = await getUploadPresignedUrl(fileKey, contentType);

      return success({
        success: true,
        uploadUrl: url,
        fileKey,
        expiresIn,
        message: 'PUT the file directly to uploadUrl with the correct Content-Type header.',
      });
    }

    // ── Download URL ────────────────────────────────────────────────────────
    if (path.endsWith('/download-url')) {
      const { fileKey, fileName } = body;
      if (!fileKey) return badRequest('fileKey is required.');

      // Students can only download their own submissions or assignment attachments
      if (caller.role === 'student') {
        const isSubmission = fileKey.startsWith('submissions/') && fileKey.includes(caller.userId);
        const isAttachment = fileKey.startsWith('assignment_docs/');
        if (!isSubmission && !isAttachment) {
          return forbidden('You are not authorized to download this file.');
        }
      }

      const { url, expiresIn } = await getDownloadPresignedUrl(fileKey, fileName || fileKey.split('/').pop());

      return success({
        success: true,
        downloadUrl: url,
        expiresIn,
        fileName: fileName || fileKey.split('/').pop(),
      });
    }

    return badRequest('Unknown file operation.');

  } catch (err) {
    if (err.message.includes('Invalid file type')) return badRequest(err.message);
    return serverError('File operation failed.', err);
  }
};
