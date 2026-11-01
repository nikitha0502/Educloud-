/**
 * Lambda: POST /auth/login
 * Authenticates a user via Cognito and returns tokens.
 */

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} = require('@aws-sdk/client-cognito-identity-provider');
const { TABLES, queryItems } = require('../../utils/dynamo');
const { success, badRequest, unauthorized, serverError, cors, parseBody } = require('../../utils/response');

const cognito   = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  try {
    const { email, password } = parseBody(event);

    if (!email?.trim())  return badRequest('Email is required.');
    if (!password)       return badRequest('Password is required.');

    // ── Cognito auth ─────────────────────────────────────────────────────────
    const authResult = await cognito.send(new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email.toLowerCase(),
        PASSWORD: password,
      },
    }));

    const tokens = authResult.AuthenticationResult;
    if (!tokens) return unauthorized('Authentication failed.');

    // ── Fetch user profile from DynamoDB ──────────────────────────────────────
    const users = await queryItems(
      TABLES.USERS,
      'EmailIndex',
      'email = :email',
      { ':email': email.toLowerCase() }
    );

    const user = users[0];
    if (!user) {
      return serverError('User profile not found after authentication.');
    }

    return success({
      success: true,
      token: tokens.AccessToken,
      idToken: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      expiresIn: tokens.ExpiresIn,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        enrollmentId: user.enrollmentId,
        createdAt: user.createdAt,
      },
    });

  } catch (err) {
    console.error('[Login]', err);

    if (err.name === 'NotAuthorizedException') {
      return unauthorized('Invalid email or password.');
    }
    if (err.name === 'UserNotFoundException') {
      return unauthorized('Invalid email or password.');
    }
    if (err.name === 'UserNotConfirmedException') {
      return badRequest('Please verify your email before logging in.');
    }

    return serverError('Login failed. Please try again.', err);
  }
};
