/**
 * Lambda: POST /assignments
 * Faculty only — creates a new assignment.
 */

const { v4: uuidv4 } = require('uuid');
const { TABLES, putItem } = require('../../utils/dynamo');
const { success, created, badRequest, forbidden, serverError, cors, parseBody, getUserFromEvent } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const caller = getUserFromEvent(event);
    if (!caller || caller.role !== 'faculty') return forbidden('Only faculty members can create assignments.');

    const body = parseBody(event);
    const { title, description, instructions, deadline, totalMarks, allowLate, attachmentKey, attachmentName } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!title?.trim())       return badRequest('Assignment title is required.');
    if (!description?.trim()) return badRequest('Description is required.');
    if (!deadline)            return badRequest('Deadline is required.');

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) return badRequest('Invalid deadline date.');
    if (deadlineDate <= new Date()) return badRequest('Deadline must be in the future.');

    const marks = parseInt(totalMarks);
    if (isNaN(marks) || marks < 1 || marks > 1000) return badRequest('Total marks must be between 1 and 1000.');

    // ── Create assignment ────────────────────────────────────────────────────
    const assignment = {
      assignmentId: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      instructions: instructions?.trim() || '',
      facultyId: caller.userId,
      facultyName: caller.name || 'Faculty',
      deadline: deadlineDate.toISOString(),
      totalMarks: marks,
      allowLate: !!allowLate,
      attachmentKey: attachmentKey || null,
      attachmentName: attachmentName || null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await putItem(TABLES.ASSIGNMENTS, assignment);

    return created({ success: true, assignment });

  } catch (err) {
    return serverError('Failed to create assignment.', err);
  }
};
