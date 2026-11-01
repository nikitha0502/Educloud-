/**
 * config.js — Central configuration
 *
 * MODE: MOCK — all data lives in the browser's localStorage via MockDB.
 * No AWS credentials, no backend calls, no external services required.
 * Works on Vercel with zero environment variables.
 *
 * Demo credentials (pre-seeded by mock-db.js):
 *   Faculty : faculty@demo.com  / Faculty@123
 *   Student : student@demo.com  / Student@123
 *   Student : maria@demo.com    / Student@123
 */

const APP_CONFIG = {
  // ─── Mode ─────────────────────────────────────────────────────────────────
  USE_MOCK: true,   // All API calls go to MockDB — no AWS, no backend

  // ─── App Metadata ─────────────────────────────────────────────────────────
  APP_NAME: 'EduCloud',
  APP_VERSION: '1.0.0',
  COLLEGE_NAME: 'CloudTech University',

  // ─── Backend URL (unused in mock mode, kept for reference) ───────────────
  BACKEND_URL: 'https://educloud-backend-jrmy.onrender.com',

  // ─── AWS block (unused in mock mode — kept so nothing breaks if referenced)
  AWS: {
    REGION: 'us-east-1',
    API_GATEWAY_URL: 'https://educloud-backend-jrmy.onrender.com',
    COGNITO: { USER_POOL_ID: '', CLIENT_ID: '' },
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
  TOKEN_KEY:   'educloud_token',

  // ─── Pagination ───────────────────────────────────────────────────────────
  PAGE_SIZE: 10,
};

APP_CONFIG.API_BASE = 'MOCK';

window.APP_CONFIG = APP_CONFIG;
