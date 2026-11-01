/**
 * Unit tests — Assignment handlers
 */

jest.mock('../../src/utils/dynamo');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));

const { handler: createHandler } = require('../../src/handlers/assignments/create');
const { handler: updateHandler } = require('../../src/handlers/assignments/update');
const dynamo = require('../../src/utils/dynamo');

function makeEvent(method, body, pathParams = {}, role = 'faculty', userId = 'faculty-001') {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
    pathParameters: pathParams,
    requestContext: {
      authorizer: { userId, role, name: 'Dr. Smith', email: 'smith@uni.edu' }
    }
  };
}

const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
const validPayload = {
  title: 'Cloud Computing Assignment',
  description: 'Design a cloud architecture.',
  deadline: futureDate,
  totalMarks: 100,
  allowLate: false,
};

// ─── Create Assignment ────────────────────────────────────────────────────────
describe('POST /assignments', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    dynamo.putItem.mockResolvedValue(true);
  });

  test('returns 403 if caller is a student', async () => {
    const event = makeEvent('POST', validPayload, {}, 'student', 'student-001');
    const res = JSON.parse((await createHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('faculty');
  });

  test('returns 400 if title is missing', async () => {
    const { title, ...noTitle } = validPayload;
    const event = makeEvent('POST', noTitle);
    const res = JSON.parse((await createHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('title');
  });

  test('returns 400 if description is missing', async () => {
    const { description, ...noDesc } = validPayload;
    const event = makeEvent('POST', noDesc);
    const res = JSON.parse((await createHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Description');
  });

  test('returns 400 if deadline is in the past', async () => {
    const event = makeEvent('POST', { ...validPayload, deadline: '2020-01-01T00:00:00Z' });
    const res = JSON.parse((await createHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('future');
  });

  test('returns 400 for invalid totalMarks', async () => {
    const event = makeEvent('POST', { ...validPayload, totalMarks: 0 });
    const res = JSON.parse((await createHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('marks');
  });

  test('creates assignment successfully', async () => {
    const event = makeEvent('POST', validPayload);
    const result = await createHandler(event);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.assignment.assignmentId).toBe('mock-uuid-1234');
    expect(body.assignment.facultyId).toBe('faculty-001');
    expect(dynamo.putItem).toHaveBeenCalledTimes(1);
  });
});

// ─── Update / Delete Assignment ───────────────────────────────────────────────
describe('PUT/DELETE /assignments/{id}', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    dynamo.getItem.mockResolvedValue({
      assignmentId: 'asgn-001',
      facultyId: 'faculty-001',
      title: 'Old Title',
    });
    dynamo.updateItem.mockResolvedValue({ assignmentId: 'asgn-001', title: 'New Title' });
    dynamo.deleteItem.mockResolvedValue(true);
  });

  test('returns 403 if caller is student', async () => {
    const event = makeEvent('PUT', { title: 'New' }, { id: 'asgn-001' }, 'student');
    const res = JSON.parse((await updateHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('faculty');
  });

  test('returns 403 if faculty tries to modify another faculty\'s assignment', async () => {
    dynamo.getItem.mockResolvedValue({ assignmentId: 'asgn-001', facultyId: 'faculty-999' });
    const event = makeEvent('PUT', { title: 'New' }, { id: 'asgn-001' }, 'faculty', 'faculty-001');
    const res = JSON.parse((await updateHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('own');
  });

  test('updates assignment successfully', async () => {
    const event = makeEvent('PUT', { title: 'New Title' }, { id: 'asgn-001' });
    const result = await updateHandler(event);
    expect(result.statusCode).toBe(200);
    expect(dynamo.updateItem).toHaveBeenCalledTimes(1);
  });

  test('deletes assignment successfully', async () => {
    const event = makeEvent('DELETE', {}, { id: 'asgn-001' });
    const result = await updateHandler(event);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(dynamo.deleteItem).toHaveBeenCalledTimes(1);
  });
});
