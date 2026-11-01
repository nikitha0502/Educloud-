/**
 * Lambda: PUT /assignments/{id}    — faculty updates own assignment
 *         DELETE /assignments/{id} — faculty deletes own assignment
 */

const { TABLES, getItem, updateItem, deleteItem } = require('../../utils/dynamo');
const { success, badRequest, forbidden, notFound, serverError, cors, parseBody, getUserFromEvent } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const caller = getUserFromEvent(event);
    if (!caller || caller.role !== 'faculty') return forbidden('Only faculty can modify assignments.');

    const { id } = event.pathParameters;
    const assignment = await getItem(TABLES.ASSIGNMENTS, { assignmentId: id });
    if (!assignment) return notFound('Assignment not found.');
    if (assignment.facultyId !== caller.userId) return forbidden('You can only modify your own assignments.');

    if (event.httpMethod === 'DELETE') {
      await deleteItem(TABLES.ASSIGNMENTS, { assignmentId: id });
      return success({ success: true, message: 'Assignment deleted.' });
    }

    // PUT — update
    const body = parseBody(event);
    const allowed = ['title', 'description', 'instructions', 'deadline', 'totalMarks', 'allowLate', 'attachmentKey', 'attachmentName'];
    const updates = { updatedAt: new Date().toISOString() };
    allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k]; });

    if (updates.deadline) {
      const d = new Date(updates.deadline);
      if (isNaN(d.getTime())) return badRequest('Invalid deadline date.');
      updates.deadline = d.toISOString();
    }
    if (updates.totalMarks !== undefined) {
      const m = parseInt(updates.totalMarks);
      if (isNaN(m) || m < 1) return badRequest('Invalid totalMarks.');
      updates.totalMarks = m;
    }

    const updated = await updateItem(TABLES.ASSIGNMENTS, { assignmentId: id }, updates);
    return success({ success: true, assignment: updated });

  } catch (err) {
    return serverError('Failed to update assignment.', err);
  }
};
