/**
 * response.js — Standard HTTP response helpers for Lambda functions.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
  'Content-Type': 'application/json',
};

function success(body, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function created(body) {
  return success(body, 201);
}

function badRequest(message = 'Bad request', details = null) {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, message, ...(details && { details }) }),
  };
}

function unauthorized(message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, message }),
  };
}

function forbidden(message = 'Forbidden') {
  return {
    statusCode: 403,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, message }),
  };
}

function notFound(message = 'Not found') {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, message }),
  };
}

function serverError(message = 'Internal server error', err = null) {
  if (err) console.error('[ServerError]', err);
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, message }),
  };
}

function cors() {
  return { statusCode: 200, headers: CORS_HEADERS, body: '' };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function getUserFromEvent(event) {
  // The authorizer context attached by Cognito / API Gateway
  const ctx = event.requestContext?.authorizer;
  if (!ctx) return null;
  return {
    userId: ctx.userId || ctx.sub,
    email:  ctx.email,
    role:   ctx['custom:role'] || ctx.role,
    name:   ctx.name,
  };
}

module.exports = { success, created, badRequest, unauthorized, forbidden, notFound, serverError, cors, parseBody, getUserFromEvent };
