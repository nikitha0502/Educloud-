const path = require('path');
const Module = require('module');

// Intercept require to provide mock modules for backend unit tests
const originalRequire = Module.prototype.require;

let dynamoGetItemImpl = () => Promise.resolve(null);
let dynamoPutItemImpl = () => Promise.resolve(true);
let dynamoQueryItemsImpl = () => Promise.resolve([]);

const mockDynamo = {
  TABLES: {
    USERS: 'EduCloud-Users',
    ASSIGNMENTS: 'EduCloud-Assignments',
    SUBMISSIONS: 'EduCloud-Submissions',
  },
  getItem: (...args) => dynamoGetItemImpl(...args),
  putItem: (...args) => dynamoPutItemImpl(...args),
  updateItem: () => Promise.resolve(null),
  deleteItem: () => Promise.resolve(true),
  queryItems: (...args) => dynamoQueryItemsImpl(...args),
  scanItems: () => Promise.resolve([]),
};

const mockCognito = {
  CognitoIdentityProviderClient: class {
    send(command) { return Promise.resolve({}); }
  },
  SignUpCommand: class {},
  AdminAddUserToGroupCommand: class {},
  AdminConfirmSignUpCommand: class {},
  InitiateAuthCommand: class {},
  AuthFlowType: { USER_PASSWORD_AUTH: 'USER_PASSWORD_AUTH' },
};

const mockS3 = {
  S3Client: class {},
  DeleteObjectCommand: class {},
  PutObjectCommand: class {},
  GetObjectCommand: class {},
};

const mockPresigner = {
  getSignedUrl: () => Promise.resolve('https://s3.amazonaws.com/mock-signed-url'),
};

const mockUuid = {
  v4: () => 'mock-uuid-1234',
};

Module.prototype.require = function (id) {
  if (id === '@aws-sdk/client-cognito-identity-provider') return mockCognito;
  if (id === '@aws-sdk/client-dynamodb') return {};
  if (id === '@aws-sdk/client-s3') return mockS3;
  if (id === '@aws-sdk/lib-dynamodb') return {};
  if (id === '@aws-sdk/s3-request-presigner') return mockPresigner;
  if (id === 'uuid') return mockUuid;
  if (id.endsWith('utils/dynamo')) return mockDynamo;
  return originalRequire.apply(this, arguments);
};

// Simple test framework simulating Jest describe, it, expect, beforeEach
const testResults = { total: 0, pass: 0, fail: 0, failures: [] };
let beforeEachHooks = [];

function describe(suiteName, fn) {
  console.log(`\n📦 ${suiteName}`);
  beforeEachHooks = [];
  fn();
}

function beforeEach(fn) {
  beforeEachHooks.push(fn);
}

function test(testName, fn) {
  testResults.total++;
  for (const h of beforeEachHooks) h();

  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      res.then(() => {
        testResults.pass++;
        console.log(`  ✅ ${testName}`);
      }).catch(err => {
        testResults.fail++;
        testResults.failures.push({ testName, err: err.message });
        console.log(`  ❌ ${testName}: ${err.message}`);
      });
    } else {
      testResults.pass++;
      console.log(`  ✅ ${testName}`);
    }
  } catch (err) {
    testResults.fail++;
    testResults.failures.push({ testName, err: err.message });
    console.log(`  ❌ ${testName}: ${err.message}`);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    },
    toContain: (substring) => {
      if (!String(actual).includes(substring)) throw new Error(`Expected "${actual}" to contain "${substring}"`);
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    },
    toHaveBeenCalledTimes: () => {},
  };
}

global.describe = describe;
global.test = test;
global.it = test;
global.beforeEach = beforeEach;
global.expect = expect;
global.jest = {
  mock: () => {},
  clearAllMocks: () => {},
};

// Now run the backend test suites
const registerHandler = require('../backend/src/handlers/auth/register').handler;
const loginHandler    = require('../backend/src/handlers/auth/login').handler;
const createHandler   = require('../backend/src/handlers/assignments/create').handler;
const getAsgnHandler  = require('../backend/src/handlers/assignments/get').handler;
const updateAsgnHandler = require('../backend/src/handlers/assignments/update').handler;
const submitHandler   = require('../backend/src/handlers/submissions/submit').handler;
const getSubHandler   = require('../backend/src/handlers/submissions/get').handler;
const presignedHandler = require('../backend/src/handlers/files/presigned').handler;

function makeEvent(method, body = null, pathParams = null, qs = null, auth = null) {
  return {
    httpMethod: method,
    body: body ? JSON.stringify(body) : null,
    pathParameters: pathParams || null,
    queryStringParameters: qs || null,
    requestContext: { authorizer: auth || null },
  };
}

// Suite 1: Auth
describe('Auth Handlers', () => {
  test('register returns 400 when name is missing', async () => {
    const res = await registerHandler(makeEvent('POST', { email: 't@t.com', password: 'Password@123', role: 'student' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Name is required');
  });

  test('register returns 400 for invalid email', async () => {
    const res = await registerHandler(makeEvent('POST', { name: 'John', email: 'invalid', password: 'Password@123', role: 'student' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Invalid email');
  });

  test('register returns 400 for short password', async () => {
    const res = await registerHandler(makeEvent('POST', { name: 'John', email: 'j@t.com', password: 'short', role: 'student' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('8 characters');
  });

  test('login returns 400 when email is missing', async () => {
    const res = await loginHandler(makeEvent('POST', { password: 'Password@123' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Email is required');
  });

  test('login returns 400 when password is missing', async () => {
    const res = await loginHandler(makeEvent('POST', { email: 'test@demo.com' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Password is required');
  });
});

// Suite 2: Assignments
describe('Assignment Handlers', () => {
  const facultyAuth = { userId: 'faculty-001', role: 'faculty', name: 'Dr. Sarah' };
  const studentAuth = { userId: 'student-001', role: 'student', name: 'Alex' };
  const future = new Date(Date.now() + 7 * 86400000).toISOString();

  test('create returns 403 when called by student', async () => {
    const res = await createHandler(makeEvent('POST', { title: 'Test', description: 'Desc', deadline: future, totalMarks: 100 }, null, null, studentAuth));
    expect(res.statusCode).toBe(403);
  });

  test('create returns 400 when title is missing', async () => {
    const res = await createHandler(makeEvent('POST', { description: 'Desc', deadline: future, totalMarks: 100 }, null, null, facultyAuth));
    expect(res.statusCode).toBe(400);
  });

  test('create returns 400 when deadline is in the past', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const res = await createHandler(makeEvent('POST', { title: 'Test', description: 'Desc', deadline: past, totalMarks: 100 }, null, null, facultyAuth));
    expect(res.statusCode).toBe(400);
  });

  test('create succeeds with valid faculty data', async () => {
    const res = await createHandler(makeEvent('POST', { title: 'Cloud Assignment', description: 'Desc', deadline: future, totalMarks: 100 }, null, null, facultyAuth));
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});

// Suite 3: Submissions
describe('Submission Handlers', () => {
  const studentAuth = { userId: 'student-001', role: 'student', name: 'Alex' };
  const facultyAuth = { userId: 'faculty-001', role: 'faculty', name: 'Dr. Sarah' };
  const future = new Date(Date.now() + 7 * 86400000).toISOString();

  beforeEach(() => {
    dynamoGetItemImpl = (table, key) => Promise.resolve({
      assignmentId: key.assignmentId || 'asgn-001',
      title: 'Cloud Assignment',
      deadline: future,
      allowLate: false,
      totalMarks: 100
    });
    dynamoQueryItemsImpl = () => Promise.resolve([]);
    dynamoPutItemImpl = () => Promise.resolve(true);
  });

  test('submit returns 403 if called by faculty', async () => {
    const res = await submitHandler(makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/a.pdf', fileName: 'a.pdf' }, null, null, facultyAuth));
    expect(res.statusCode).toBe(403);
  });

  test('submit returns 400 for invalid file extension', async () => {
    const res = await submitHandler(makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/a.exe', fileName: 'a.exe' }, null, null, studentAuth));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('Invalid file type');
  });

  test('submit succeeds with valid PDF', async () => {
    const res = await submitHandler(makeEvent('POST', { assignmentId: 'asgn-001', fileKey: 'sub/a.pdf', fileName: 'report.pdf', fileSize: 1024 }, null, null, studentAuth));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});

// Final report
setTimeout(() => {
  console.log('\n========================================');
  console.log(`EduCloud Backend Test Results`);
  console.log('========================================');
  console.log(`Total: ${testResults.total} | Passed: ${testResults.pass} | Failed: ${testResults.fail}`);
  if (testResults.fail === 0) {
    console.log('🎉 All backend tests passed!\n');
    process.exit(0);
  } else {
    console.error('❌ Some backend tests failed!\n');
    process.exit(1);
  }
}, 500);
