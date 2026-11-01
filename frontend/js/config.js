/**
 * config.js — Central configuration
 * Automatically switches between MOCK (local file://) and REAL (production) modes.
 *
 * MOCK mode  : used when opening HTML files directly from disk (file://)
 * REAL mode  : used on Vercel — talks to the Render backend
 *
 * ⚠️  Never put AWS credentials here. They live in Render environment variables.
 */

// ─── Detect environment ───────────────────────────────────────────────────────
const _isLocal = (typeof window !== 'undefined') &&
  (window.location.protocol === 'file:' || window.location.hostname === 'localhost');

const APP_CONFIG = {
  // ─── Toggle ──────────────────────────────────────────────────────────────
  // Auto: mock when running locally from disk, real when on Vercel
  USE_MOCK: _isLocal,

  // ─── App Metadata ─────────────────────────────────────────────────────────
  APP_NAME: 'EduCloud',
  APP_VERSION: '1.0.0',
  COLLEGE_NAME: 'CloudTech University',

  // ─── Backend (Render) ─────────────────────────────────────────────────────
  // All API calls go through this Express backend — no direct AWS calls from frontend.
  BACKEND_URL: 'https://educloud-backend-jrmy.onrender.com',

  // ─── AWS config block (kept for reference / future use) ───────────────────
  // Actual secrets live in Render environment variables — never here.
  AWS: {
    REGION: 'us-east-1',
    // Legacy field kept so existing api.js http() calls resolve correctly:
    API_GATEWAY_URL: 'https://educloud-backend-jrmy.onrender.com',
    COGNITO: {
      USER_POOL_ID: '',   // set in Render env: COGNITO_USER_POOL_ID
      CLIENT_ID: '',       // set in Render env: COGNITO_CLIENT_ID
    },
    S3_BUCKET: 'educloud-assignments-bucket',
  },

  // ─── File Constraints ─────────────────────────────────────────────────────
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.docx'],
  MAX_FILE_SIZE_MB: 25,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,

  // ─── Session ──────────────────────────────────────────────────────────────
  SESSION_KEY: 'educloud_session',
  TOKEN_KEY: 'educloud_token',

  // ─── Pagination ───────────────────────────────────────────────────────────
  PAGE_SIZE: 10,
};

// Derived helper — used by api.js http() function
APP_CONFIG.API_BASE = APP_CONFIG.USE_MOCK
  ? 'MOCK'
  : APP_CONFIG.BACKEND_URL;

window.APP_CONFIG = APP_CONFIG;
