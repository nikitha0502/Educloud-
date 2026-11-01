/**
 * Integration tests — End-to-end API flow using mock data.
 * These tests simulate the full request → Lambda → DynamoDB → response cycle.
 */

jest.mock('../../src/utils/dynamo');
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('uuid', () => ({ v4: () => 'integration-test-uuid' }));

const { handler: createHandler } = require('../../src/handlers/assignments/create');
const { handler: submitHandler } = require('../../src/handlers/submissions/submit');
const { handler: getSubHandler } = require('../../src/handlers/submissions/get');
const dynamo = require('../../src/utils/dynamo');

const futureDeadline = new Date(Date.now() + 10 * 86400000).toISOString();

const facultyContext = { userId: 'faculty-001', role: 'faculty', name: 'Dr. Smith' };
const studentContext = { userId: 'student-001', role: 'student', name: 'Alex' };

function event(method, body, pathParams, qs, auth) {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
    pathParameters: pathParams || {},
    queryStringParameters: qs || null,
    requestContext: { authorizer: auth },
  };
}

describe('Integration: Assignment Create → Submit → Grade flow', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    dynamo.putItem.mockResolvedValue(true);
    dynamo.updateItem.mockResolvedValue({ submissionId: 'integration-test-uuid' });
    dynamo.queryItems.mockResolvedValue([]);
  });

  test('Faculty creates an assignment', async () => {
    const e = event('POST', {
      title: 'Integration Test Assignment',
      description: 'Test description',
      deadline: futureDeadline,
      totalMarks: 50,
    }, null, null, facultyContext);

    const res = await createHandler(e);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.assignment.title).toBe('Integration Test Assignment');
    expect(body.assignment.facultyId).toBe('faculty-001');
  });

  test('Student submits the assignment', async () => {
    dynamo.getItem.mockResolvedValue({
      assignmentId: 'integration-test-uuid',
      deadline: futureDeadline,
      allowLate: false,
    });

    const e = event('POST', {
      assignmentId: 'integration-test-uuid',
      fileKey: 'submissions/student-001/report.pdf',
      fileName: 'report.pdf',
      fileSize: 500000,
    }, null, null, studentContext);

    const res = await submitHandler(e);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.submission.isLate).toBe(false);
    expect(dynamo.putItem).toHaveBeenCalledTimes(1);
  });

  test('Faculty views submissions for assignment', async () => {
    dynamo.queryItems.mockResolvedValue([
      { submissionId: 'sub-1', studentId: 'student-001', assignmentId: 'asgn-001' },
      { submissionId: 'sub-2', studentId: 'student-002', assignmentId: 'asgn-001' },
    ]);

    const e = event('GET', {}, {}, { assignmentId: 'asgn-001' }, facultyContext);
    const res = await getSubHandler(e);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.submissions.length).toBe(2);
  });

  test('Faculty grades a submission', async () => {
    dynamo.getItem.mockResolvedValue({
      submissionId: 'sub-1',
      studentId: 'student-001',
      assignmentId: 'asgn-001',
    });
    dynamo.updateItem.mockResolvedValue({ submissionId: 'sub-1', grade: 42, feedback: 'Good work!' });

    const e = event('PUT', { grade: 42, feedback: 'Good work!' }, { id: 'sub-1', action: 'grade' }, null, facultyContext);
    const res = await getSubHandler(e);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.submission.grade).toBe(42);
  });

  test('Student cannot grade a submission', async () => {
    const e = event('PUT', { grade: 100 }, { id: 'sub-1', action: 'grade' }, null, studentContext);
    const res = await getSubHandler(e);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
