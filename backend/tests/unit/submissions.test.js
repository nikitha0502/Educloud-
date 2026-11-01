/**
 * Unit tests — Submission handler
 */

jest.mock('../../src/utils/dynamo');
jest.mock('uuid', () => ({ v4: () => 'mock-sub-uuid' }));

const { handler: submitHandler } = require('../../src/handlers/submissions/submit');
const { handler: getHandler }    = require('../../src/handlers/submissions/get');
const dynamo = require('../../src/utils/dynamo');

function makeEvent(method, body = {}, pathParams = {}, role = 'student', userId = 'student-001') {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
    pathParameters: pathParams,
    queryStringParameters: null,
    requestContext: {
      authorizer: { userId, role, name: 'Alex Student', email: 'alex@uni.edu' }
    }
  };
}

const futureDate  = new Date(Date.now() + 5 * 86400000).toISOString();
const pastDate    = new Date(Date.now() - 5 * 86400000).toISOString();

const baseAssignment = {
  assignmentId: 'asgn-001',
  title: 'Test Assignment',
  deadline: futureDate,
  allowLate: false,
  totalMarks: 100,
};

// ─── Submit ───────────────────────────────────────────────────────────────────
describe('POST /submissions', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    dynamo.getItem.mockResolvedValue(baseAssignment);
    dynamo.queryItems.mockResolvedValue([]);
    dynamo.putItem.mockResolvedValue(true);
  });

  test('returns 403 if caller is faculty', async () => {
    const event = makeEvent('POST', {}, {}, 'faculty', 'faculty-001');
    const res = JSON.parse((await submitHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('students');
  });

  test('returns 400 if assignmentId is missing', async () => {
    const event = makeEvent('POST', { fileKey: 'f.pdf', fileName: 'f.pdf' });
    const res = JSON.parse((await submitHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('assignmentId');
  });

  test('returns 400 if fileKey is missing', async () => {
    const event = makeEvent('POST', { assignmentId: 'asgn-001', fileName: 'f.pdf' });
    const res = JSON.parse((await submitHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('fileKey');
  });

  test('returns 400 for invalid file extension', async () => {
    const event = makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'submissions/f.exe', fileName: 'f.exe' });
    const res = JSON.parse((await submitHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid file type');
  });

  test('returns 400 when deadline passed and late not allowed', async () => {
    dynamo.getItem.mockResolvedValue({ ...baseAssignment, deadline: pastDate, allowLate: false });
    const event = makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/f.pdf', fileName: 'f.pdf' });
    const res = JSON.parse((await submitHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('deadline');
  });

  test('allows late submission when allowLate is true', async () => {
    dynamo.getItem.mockResolvedValue({ ...baseAssignment, deadline: pastDate, allowLate: true });
    const event = makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/f.pdf', fileName: 'f.pdf' });
    const result = await submitHandler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.submission.isLate).toBe(true);
  });

  test('submits successfully for a valid request', async () => {
    const event = makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/f.pdf', fileName: 'report.pdf', fileSize: 1048576 });
    const result = await submitHandler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.submission.submissionId).toBe('mock-sub-uuid');
    expect(body.submission.isLate).toBe(false);
    expect(dynamo.putItem).toHaveBeenCalledTimes(1);
  });

  test('resubmits if previous submission exists', async () => {
    dynamo.queryItems.mockResolvedValue([{ submissionId: 'existing-sub', assignmentId: 'asgn-001' }]);
    dynamo.updateItem.mockResolvedValue({ submissionId: 'existing-sub', assignmentId: 'asgn-001' });
    const event = makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/f2.pdf', fileName: 'updated.pdf' });
    const result = await submitHandler(event);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(true);
    expect(dynamo.updateItem).toHaveBeenCalledTimes(1);
    expect(dynamo.putItem).not.toHaveBeenCalled();
  });
});

// ─── Get Submissions ──────────────────────────────────────────────────────────
describe('GET /submissions', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    dynamo.queryItems.mockResolvedValue([
      { submissionId: 'sub-001', studentId: 'student-001', assignmentId: 'asgn-001' }
    ]);
  });

  test('student cannot see another student\'s submissions', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: {},
      queryStringParameters: { studentId: 'student-999' },
      requestContext: { authorizer: { userId: 'student-001', role: 'student' } }
    };
    const res = JSON.parse((await getHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('denied');
  });

  test('student can see own submissions', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: {},
      queryStringParameters: { studentId: 'student-001' },
      requestContext: { authorizer: { userId: 'student-001', role: 'student' } }
    };
    const result = await getHandler(event);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.submissions)).toBe(true);
  });

  test('returns 400 when no query param provided', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { authorizer: { userId: 'faculty-001', role: 'faculty' } }
    };
    const res = JSON.parse((await getHandler(event)).body);
    expect(res.success).toBe(false);
  });
});
