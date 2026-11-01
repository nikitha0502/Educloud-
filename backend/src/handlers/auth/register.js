/**
 * Lambda: POST /auth/register
 * Creates a user in Cognito User Pool and stores metadata in DynamoDB.
 */

const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { v4: uuidv4 } = require('uuid');
const { TABLES, putItem } = require('../../utils/dynamo');
const { success, created, badRequest, serverError, cors, parseBody } = require('../../utils/response');

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID    = process.env.COGNITO_CLIENT_ID;

const ALLOWED_ROLES = ['student', 'faculty'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const body = parseBody(event);
    const { name, email, password, role, department, enrollmentId } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!name?.trim())         return badRequest('Name is required.');
    if (!email?.trim())        return badRequest('Email is required.');
    if (!password)             return badRequest('Password is required.');
    if (!ALLOWED_ROLES.includes(role)) return badRequest('Role must be "student" or "faculty".');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return badRequest('Invalid email format.');
    if (password.length < 8)     return badRequest('Password must be at least 8 characters.');

    // ── Cognito Sign Up ─────────────────────────────────────────────────────
    const userId = uuidv4();

    await cognito.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email.toLowerCase(),
      Password: password,
      UserAttributes: [
        { Name: 'email',        Value: email.toLowerCase() },
        { Name: 'name',         Value: name.trim() },
        { Name: 'custom:role',  Value: role },
        { Name: 'custom:userId',Value: userId },
      ],
    }));

    // Auto-confirm in dev (remove for production — use email verification)
    if (process.env.AUTO_CONFIRM === 'true') {
      await cognito.send(new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email.toLowerCase(),
      }));
    }

    // ── Add to Cognito Group ─────────────────────────────────────────────────
    await cognito.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email.toLowerCase(),
      GroupName: role === 'faculty' ? 'Faculty' : 'Students',
    }));

    // ── Store in DynamoDB ────────────────────────────────────────────────────
    const userItem = {
      userId,
      name: name.trim(),
      email: email.toLowerCase(),
      role,
      department: department || null,
      enrollmentId: enrollmentId || null,
      createdAt: new Date().toISOString(),
    };

    await putItem(TABLES.USERS, userItem);

    const { password: _, ...safeUser } = userItem;

    return created({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user: safeUser,
    });

  } catch (err) {
    console.error('[Register]', err);

    if (err.name === 'UsernameExistsException') {
      return badRequest('An account with this email already exists.');
    }
    if (err.name === 'InvalidPasswordException') {
      return badRequest('Password does not meet complexity requirements.');
    }
    if (err.name === 'InvalidParameterException') {
      return badRequest(err.message);
    }

    return serverError('Registration failed. Please try again.', err);
  }
};
