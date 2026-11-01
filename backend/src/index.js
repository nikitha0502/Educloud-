/**
 * index.js — Express server that wraps Lambda-style handlers for Railway deployment.
 *
 * Each handler follows the Lambda signature:
 *   exports.handler = async (event) => { return { statusCode, headers, body }; }
 *
 * This adapter converts Express req → Lambda event and Lambda response → Express res.
 */

'use strict';

const express    = require('express');
const cors       = require('cors');

// ── Lambda handlers ──────────────────────────────────────────────────────────
const authLogin    = require('./handlers/auth/login');
const authRegister = require('./handlers/auth/register');
const assignCreate = require('./handlers/assignments/create');
const assignGet    = require('./handlers/assignments/get');
const assignUpdate = require('./handlers/assignments/update');
const filesHandler = require('./handlers/files/presigned');
const subSubmit    = require('./handlers/submissions/submit');
const subGet       = require('./handlers/submissions/get');

// ── JWT decoder (no verify — Cognito handles that; we just need the claims) ──
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Adapt Express req → Lambda event ────────────────────────────────────────
function toEvent(req, pathParams = {}) {
  // Decode JWT if present to populate requestContext.authorizer
  let authorizer = null;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const claims = decodeJwt(authHeader.slice(7));
    if (claims) {
      authorizer = {
        userId: claims['custom:userId'] || claims.sub,
        email:  claims.email,
        role:   claims['custom:role'],
        name:   claims.name,
        sub:    claims.sub,
      };
    }
  }

  return {
    httpMethod:            req.method,
    path:                  req.path,
    resource:              req.path,
    headers:               req.headers,
    queryStringParameters: Object.keys(req.query).length ? req.query : null,
    pathParameters:        Object.keys(pathParams).length ? pathParams : null,
    body:                  req.body ? JSON.stringify(req.body) : null,
    requestContext: {
      authorizer,
    },
  };
}

// ── Adapt Lambda response → Express res ─────────────────────────────────────
function sendLambdaResponse(lambdaRes, res) {
  const statusCode = lambdaRes.statusCode || 200;
  const headers    = lambdaRes.headers    || {};
  const body       = lambdaRes.body       || '';

  Object.entries(headers).forEach(([k, v]) => {
    // Skip CORS headers — express cors() middleware handles them
    if (!k.toLowerCase().startsWith('access-control')) {
      res.setHeader(k, v);
    }
  });

  res.status(statusCode);
  if (body === '') {
    res.end();
  } else {
    try {
      res.json(JSON.parse(body));
    } catch {
      res.send(body);
    }
  }
}

// ── Wrap a Lambda handler as an Express route handler ───────────────────────
function wrap(handler, pathParamFn) {
  return async (req, res, next) => {
    try {
      const pathParams = pathParamFn ? pathParamFn(req) : {};
      const event = toEvent(req, pathParams);
      const result = await handler.handler(event);
      sendLambdaResponse(result, res);
    } catch (err) {
      next(err);
    }
  };
}

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: [
    'https://educloud-frontend-one.vercel.app',
    // Allow any *.vercel.app preview URL (Vercel deploy previews)
    /^https:\/\/educloud-.*\.vercel\.app$/,
    // Allow local dev
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    // Also honour FRONTEND_URL env var set in Render dashboard
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Handle CORS preflight globally
app.options('*', cors());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'educloud-backend' }));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/auth/login',    wrap(authLogin));
app.post('/auth/register', wrap(authRegister));

// ── Assignment routes ─────────────────────────────────────────────────────────
app.post('/assignments',        wrap(assignCreate));
app.get('/assignments',         wrap(assignGet));
app.get('/assignments/:id',     wrap(assignGet,    (req) => ({ id: req.params.id })));
app.put('/assignments/:id',     wrap(assignUpdate, (req) => ({ id: req.params.id })));
app.delete('/assignments/:id',  wrap(assignUpdate, (req) => ({ id: req.params.id })));

// ── File presigned URL routes ─────────────────────────────────────────────────
app.post('/files/upload-url',   wrap(filesHandler));
app.post('/files/download-url', wrap(filesHandler));

// ── Submission routes ─────────────────────────────────────────────────────────
app.post('/submissions',             wrap(subSubmit));
app.get('/submissions',              wrap(subGet));
app.get('/submissions/:id',          wrap(subGet, (req) => ({ id: req.params.id })));
app.put('/submissions/:id/grade',    wrap(subGet, (req) => ({ id: req.params.id, action: 'grade' })));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EduCloud backend listening on port ${PORT}`);
});

module.exports = app; // for testing
