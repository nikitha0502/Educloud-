/**
 * Lambda: GET /assignments            — all assignments (students see all, faculty see own)
 *          GET /assignments/{id}       — single assignment
 */

const { TABLES, getItem, queryItems, scanItems } = require('../../utils/dynamo');
const { success, notFound, serverError, cors, getUserFromEvent } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const caller = getUserFromEvent(event);
    const assignmentId = event.pathParameters?.id;

    if (assignmentId) {
      // ── Single assignment ──────────────────────────────────────────────────
      const assignment = await getItem(TABLES.ASSIGNMENTS, { assignmentId });
      if (!assignment) return notFound('Assignment not found.');
      return success({ success: true, assignment });
    }

    // ── List assignments ───────────────────────────────────────────────────
    const facultyId = event.queryStringParameters?.facultyId;

    if (facultyId) {
      const items = await queryItems(
        TABLES.ASSIGNMENTS,
        'FacultyIndex',
        'facultyId = :fid',
        { ':fid': facultyId }
      );
      return success({ success: true, assignments: items });
    }

    // Return all assignments (scan — fine for demo, use GSI in prod)
    const all = await scanItems(TABLES.ASSIGNMENTS);
    return success({ success: true, assignments: all });

  } catch (err) {
    return serverError('Failed to fetch assignments.', err);
  }
};
