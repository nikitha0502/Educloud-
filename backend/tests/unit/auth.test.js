/**
 * Unit tests — Authentication handlers
 */

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('../../src/utils/dynamo');

const { handler: registerHandler } = require('../../src/handlers/auth/register');
const { handler: loginHandler }    = require('../../src/handlers/auth/login');
const dynamo = require('../../src/utils/dynamo');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeEvent(method, body, pathParams = {}) {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
    pathParameters: pathParams,
    requestContext: {
      authorizer: null
    }
  };
}

// ─── Register Tests ───────────────────────────────────────────────────────────
describe('POST /auth/register', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COGNITO_CLIENT_ID    = 'test-client-id';
    process.env.COGNITO_USER_POOL_ID = 'test-pool-id';
    process.env.AUTO_CONFIRM         = 'false';
  });

  test('returns 400 when name is missing', async () => {
    const event = makeEvent('POST', { email: 'test@test.com', password: 'Test@1234', role: 'student' });
    const res = JSON.parse((await registerHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Name');
  });

  test('returns 400 when email is invalid', async () => {
    const event = makeEvent('POST', { name: 'John', email: 'not-an-email', password: 'Test@1234', role: 'student' });
    const res = JSON.parse((await registerHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('email');
  });

  test('returns 400 when password is too short', async () => {
    const event = makeEvent('POST', { name: 'John', email: 'j@test.com', password: 'abc', role: 'student' });
    const res = JSON.parse((await registerHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('8 characters');
  });

  test('returns 400 for invalid role', async () => {
    const event = makeEvent('POST', { name: 'John', email: 'j@test.com', password: 'Test@1234', role: 'admin' });
    const res = JSON.parse((await registerHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Role');
  });

  test('returns 200 for OPTIONS preflight', async () => {
    const event = { httpMethod: 'OPTIONS' };
    const res = await registerHandler(event);
    expect(res.statusCode).toBe(200);
  });
});

// ─── Login Tests ──────────────────────────────────────────────────────────────
describe('POST /auth/login', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
  });

  test('returns 400 when email is missing', async () => {
    const event = makeEvent('POST', { password: 'Test@1234' });
    const res = JSON.parse((await loginHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Email');
  });

  test('returns 400 when password is missing', async () => {
    const event = makeEvent('POST', { email: 'test@test.com' });
    const res = JSON.parse((await loginHandler(event)).body);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Password');
  });

  test('returns 200 for OPTIONS preflight', async () => {
    const event = { httpMethod: 'OPTIONS' };
    const res = await loginHandler(event);
    expect(res.statusCode).toBe(200);
  });
});
