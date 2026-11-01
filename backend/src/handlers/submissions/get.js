/**
 * Lambda: GET /submissions — fetch submissions with filters
 *         GET /submissions/{id} — single submission
 *         PUT /submissions/{id}/grade — faculty grades submission
 */

const { TABLES, getItem, queryItems, updateItem } = require('../../utils/dynamo');
const { success, badRequest, forbidden, notFound, serverError, cors, parseBody, getUserFromEvent } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const caller = getUserFromEvent(event);

  try {
    const subId = event.pathParameters?.id;
    const action = event.pathParameters?.action;

    // ── Grade submission ───────────────────────────────────────────────────
    if (subId && action === 'grade') {
      if (caller?.role !== 'faculty') return forbidden('Only faculty can grade submissions.');

      const body = parseBody(event);
      const { grade, feedback } = body;

      const sub = await getItem(TABLES.SUBMISSIONS, { submissionId: subId });
      if (!sub) return notFound('Submission not found.');

      const gradeNum = parseInt(grade);
      if (isNaN(gradeNum) || gradeNum < 0) return badRequest('Grade must be a non-negative number.');

      const updated = await updateItem(
        TABLES.SUBMISSIONS,
        { submissionId: subId },
        { grade: gradeNum, feedback: feedback || null, gradedAt: new Date().toISOString(), gradedBy: caller.userId }
      );
      return success({ success: true, submission: updated });
    }

    // ── Single submission ──────────────────────────────────────────────────
    if (subId) {
      const sub = await getItem(TABLES.SUBMISSIONS, { submissionId: subId });
      if (!sub) return notFound('Submission not found.');
      if (caller?.role === 'student' && sub.studentId !== caller.userId) return forbidden('Access denied.');
      return success({ success: true, submission: sub });
    }

    // ── List submissions ───────────────────────────────────────────────────
    const qs = event.queryStringParameters || {};

    if (qs.studentId) {
      if (caller?.role === 'student' && qs.studentId !== caller.userId) return forbidden('Access denied.');
      const items = await queryItems(TABLES.SUBMISSIONS, 'StudentIndex', 'studentId = :sid', { ':sid': qs.studentId });
      return success({ success: true, submissions: items });
    }

    if (qs.assignmentId) {
      const items = await queryItems(TABLES.SUBMISSIONS, 'AssignmentIndex', 'assignmentId = :aid', { ':aid': qs.assignmentId });
      return success({ success: true, submissions: items });
    }

    if (qs.facultyId) {
      if (caller?.role !== 'faculty') return forbidden('Access denied.');
      // Get faculty's assignments then their submissions
      const assignments = await queryItems(TABLES.ASSIGNMENTS, 'FacultyIndex', 'facultyId = :fid', { ':fid': qs.facultyId });
      const assignmentIds = assignments.map(a => a.assignmentId);
      if (assignmentIds.length === 0) return success({ success: true, submissions: [] });

      const allSubs = await Promise.all(
        assignmentIds.map(aid => queryItems(TABLES.SUBMISSIONS, 'AssignmentIndex', 'assignmentId = :aid', { ':aid': aid }))
      );
      return success({ success: true, submissions: allSubs.flat() });
    }

    return badRequest('Provide studentId, assignmentId, or facultyId as query parameter.');

  } catch (err) {
    return serverError('Failed to fetch submissions.', err);
  }
};
