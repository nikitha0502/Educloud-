/**
 * config.js — Central configuration
 * Supports both MOCK (local dev) and REAL AWS modes.
 * Set USE_MOCK = false and fill in real AWS values for production.
 */

const APP_CONFIG = {
  // ─── Toggle ──────────────────────────────────────────────────────────────
  USE_MOCK: true,   // true = local mock mode; false = real AWS

  // ─── App Metadata ─────────────────────────────────────────────────────────
  APP_NAME: 'EduCloud',
  APP_VERSION: '1.0.0',
  COLLEGE_NAME: 'CloudTech University',

  // ─── AWS Real Config (fill these when deploying) ──────────────────────────
  AWS: {
    REGION: 'us-east-1',
    API_GATEWAY_URL: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod',
    COGNITO: {
      USER_POOL_ID: 'us-east-1_XXXXXXXXX',
      CLIENT_ID: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      IDENTITY_POOL_ID: 'us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    },
    S3_BUCKET: 'educloud-assignments-bucket'
  },

  // ─── File Constraints ─────────────────────────────────────────────────────
  ALLOWED_FILE_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ALLOWED_EXTENSIONS: ['.pdf', '.docx'],
  MAX_FILE_SIZE_MB: 25,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,

  // ─── Session ──────────────────────────────────────────────────────────────
  SESSION_KEY: 'educloud_session',
  TOKEN_KEY: 'educloud_token',

  // ─── Pagination ───────────────────────────────────────────────────────────
  PAGE_SIZE: 10,
};

// Derived helpers
APP_CONFIG.API_BASE = APP_CONFIG.USE_MOCK
  ? 'MOCK'
  : APP_CONFIG.AWS.API_GATEWAY_URL;

window.APP_CONFIG = APP_CONFIG;
