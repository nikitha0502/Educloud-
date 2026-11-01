/**
 * Lambda: POST /submissions
 * Student submits (or resubmits) an assignment.
 */

const { v4: uuidv4 } = require('uuid');
const { TABLES, getItem, putItem, queryItems, updateItem } = require('../../utils/dynamo');
const { success, badRequest, forbidden, notFound, serverError, cors, parseBody, getUserFromEvent } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const caller = getUserFromEvent(event);
    if (!caller || caller.role !== 'student') return forbidden('Only students can submit assignments.');

    const body = parseBody(event);
    const { assignmentId, fileKey, fileName, fileSize } = body;

    if (!assignmentId) return badRequest('assignmentId is required.');
    if (!fileKey)       return badRequest('fileKey is required.');
    if (!fileName)      return badRequest('fileName is required.');

    // ── Load assignment ────────────────────────────────────────────────────
    const assignment = await getItem(TABLES.ASSIGNMENTS, { assignmentId });
    if (!assignment) return notFound('Assignment not found.');

    const now = new Date();
    const deadline = new Date(assignment.deadline);
    const isLate = now > deadline;

    if (isLate && !assignment.allowLate) {
      return badRequest('The submission deadline has passed and late submissions are not allowed for this assignment.');
    }

    // ── Validate file ──────────────────────────────────────────────────────
    const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
    const ext = '.' + fileName.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return badRequest('Invalid file type. Only PDF and DOCX files are accepted.');
    }
    const MAX_SIZE = 25 * 1024 * 1024;
    if (fileSize && fileSize > MAX_SIZE) {
      return badRequest('File size exceeds the 25MB limit.');
    }

    // ── Check for existing submission ──────────────────────────────────────
    const existing = await queryItems(
      TABLES.SUBMISSIONS,
      'StudentAssignmentIndex',
      'studentId = :sid AND assignmentId = :aid',
      { ':sid': caller.userId, ':aid': assignmentId }
    );

    if (existing.length > 0) {
      // Resubmit — update existing record
      const updated = await updateItem(
        TABLES.SUBMISSIONS,
        { submissionId: existing[0].submissionId },
        { fileKey, fileName, fileSize: fileSize || 0, submittedAt: now.toISOString(), isLate, status: 'submitted', grade: null, feedback: null }
      );
      return success({ success: true, submission: updated, updated: true, message: 'Submission updated successfully.' });
    }

    // ── New submission ─────────────────────────────────────────────────────
    const submission = {
      submissionId: uuidv4(),
      assignmentId,
      studentId: caller.userId,
      studentName: caller.name || 'Student',
      fileKey,
      fileName,
      fileSize: fileSize || 0,
      submittedAt: now.toISOString(),
      status: 'submitted',
      isLate,
      grade: null,
      feedback: null,
    };

    await putItem(TABLES.SUBMISSIONS, submission);
    return success({ success: true, submission, updated: false, message: 'Assignment submitted successfully.' });

  } catch (err) {
    return serverError('Failed to record submission.', err);
  }
};
