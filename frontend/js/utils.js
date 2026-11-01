/**
 * utils.js — Shared utility functions used across all pages.
 */

// ─── Toast Notifications ──────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">✕</button>
  `;
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  toast.style.animation = 'toastOut 0.3s ease forwards';
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ─── Loading Overlay ──────────────────────────────────────────────────────
function showLoading(msg = 'Loading…') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `<div class="spinner"></div><p>${escapeHtml(msg)}</p>`;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('p').textContent = msg;
  }
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ─── Date / Time ──────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(iso) {
  if (!iso) return '—';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)  return `${days}d ago`;
  return formatDate(iso);
}

function deadlineCountdown(iso) {
  const now = Date.now();
  const deadline = new Date(iso).getTime();
  const diff = deadline - now;
  if (diff <= 0) return { text: 'Expired', class: 'deadline-passed', expired: true };
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 3) return { text: `${days} days left`, class: '', expired: false };
  if (days >= 1) return { text: `${days}d ${hours}h left`, class: 'deadline-warning', expired: false };
  return { text: `${hours}h left`, class: 'deadline-danger', expired: false };
}

function isDeadlinePassed(iso) {
  return new Date(iso).getTime() < Date.now();
}

// ─── File Helpers ─────────────────────────────────────────────────────────
function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function validateFile(file) {
  if (!file) return { valid: false, message: 'No file selected.' };
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!APP_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, message: `Invalid file type. Only PDF and DOCX files are allowed.` };
  }
  if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
    return { valid: false, message: `File size exceeds ${APP_CONFIG.MAX_FILE_SIZE_MB}MB limit.` };
  }
  return { valid: true };
}

function getFileIcon(fileName) {
  if (!fileName) return '📄';
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'pdf')  return '📕';
  if (ext === 'docx' || ext === 'doc') return '📘';
  return '📄';
}

// ─── Status Badges ────────────────────────────────────────────────────────
function submissionStatusBadge(sub, deadline) {
  if (sub) {
    if (sub.isLate) return `<span class="badge badge-warning">Late</span>`;
    return `<span class="badge badge-success">Submitted</span>`;
  }
  if (isDeadlinePassed(deadline)) return `<span class="badge badge-danger">Overdue</span>`;
  return `<span class="badge badge-info">Pending</span>`;
}

function assignmentStatusBadge(status, deadline) {
  if (status === 'closed' || isDeadlinePassed(deadline)) {
    return `<span class="badge badge-gray">Closed</span>`;
  }
  return `<span class="badge badge-success">Active</span>`;
}

// ─── HTML Escaping ────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Pagination ───────────────────────────────────────────────────────────
function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    pages: Math.ceil(items.length / pageSize),
    page,
  };
}

function renderPagination(containerId, pagination, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el || pagination.pages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = `<div class="pagination">`;
  html += `<button class="btn btn-ghost btn-sm" ${pagination.page === 1 ? 'disabled' : ''} data-page="${pagination.page - 1}">‹ Prev</button>`;
  for (let i = 1; i <= pagination.pages; i++) {
    html += `<button class="btn btn-sm ${i === pagination.page ? 'btn-primary' : 'btn-ghost'}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="btn btn-ghost btn-sm" ${pagination.page === pagination.pages ? 'disabled' : ''} data-page="${pagination.page + 1}">Next ›</button>`;
  html += `</div>`;
  el.innerHTML = html;
  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
  });
}

// ─── Avatar Initials ──────────────────────────────────────────────────────
function getInitials(name) {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Logout ───────────────────────────────────────────────────────────────
function logout() {
  API.clearSession();
  showToast('Logged out successfully.', 'info', 1500);
  // Always go to login.html — works whether we're in /pages/ or root
  setTimeout(() => {
    if (window.location.href.includes('/pages/') || window.location.href.includes('\\pages\\')) {
      window.location.href = 'login.html';
    } else {
      window.location.href = 'pages/login.html';
    }
  }, 600);
}

// ─── Sidebar Mobile Toggle ────────────────────────────────────────────────
function initSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.querySelector('.sidebar-overlay');
  const menuBtn  = document.querySelector('.menu-toggle');
  if (!sidebar) return;

  menuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    overlay?.classList.toggle('active');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  });
}

// ─── Active nav item ──────────────────────────────────────────────────────
function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === page) item.classList.add('active');
  });
}

// ─── Form Validation ──────────────────────────────────────────────────────
function validateRequired(fieldId, errorId, message = 'This field is required.') {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (!field) return true;
  const val = field.value.trim();
  if (!val) {
    field.classList.add('is-invalid');
    if (error) { error.textContent = message; error.classList.add('visible'); }
    return false;
  }
  field.classList.remove('is-invalid');
  if (error) error.classList.remove('visible');
  return true;
}

function validateEmail(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (!field) return true;
  const val = field.value.trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(val)) {
    field.classList.add('is-invalid');
    if (error) { error.textContent = 'Enter a valid email address.'; error.classList.add('visible'); }
    return false;
  }
  field.classList.remove('is-invalid');
  if (error) error.classList.remove('visible');
  return true;
}

function validatePassword(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (!field) return true;
  const val = field.value;
  const errors = [];
  if (val.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(val)) errors.push('one uppercase letter');
  if (!/[0-9]/.test(val)) errors.push('one number');
  if (errors.length) {
    field.classList.add('is-invalid');
    if (error) { error.textContent = `Password needs: ${errors.join(', ')}.`; error.classList.add('visible'); }
    return false;
  }
  field.classList.remove('is-invalid');
  if (error) error.classList.remove('visible');
  return true;
}

// ─── Mock mode banner ─────────────────────────────────────────────────────
function showMockBanner() {
  if (!APP_CONFIG.USE_MOCK) return;
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e1b4b;color:#a5b4fc;text-align:center;font-size:0.75rem;padding:6px;z-index:9999;font-family:monospace;';
  banner.textContent = '🔧 MOCK MODE — Running with local simulated data. Set USE_MOCK=false in config.js for real AWS integration.';
  document.body.appendChild(banner);
}

// ─── Modal helpers ────────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}
function initModals() {
  document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) modal.classList.remove('active');
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('active');
    });
  });
}

// ─── Debounce ─────────────────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Expose globals
window.showToast     = showToast;
window.showLoading   = showLoading;
window.hideLoading   = hideLoading;
window.formatDate    = formatDate;
window.formatDateTime = formatDateTime;
window.timeAgo       = timeAgo;
window.deadlineCountdown = deadlineCountdown;
window.isDeadlinePassed  = isDeadlinePassed;
window.formatFileSize    = formatFileSize;
window.validateFile      = validateFile;
window.getFileIcon       = getFileIcon;
window.submissionStatusBadge  = submissionStatusBadge;
window.assignmentStatusBadge  = assignmentStatusBadge;
window.escapeHtml        = escapeHtml;
window.paginate          = paginate;
window.renderPagination  = renderPagination;
window.getInitials       = getInitials;
window.logout            = logout;
window.initSidebar       = initSidebar;
window.setActiveNav      = setActiveNav;
window.validateRequired  = validateRequired;
window.validateEmail     = validateEmail;
window.validatePassword  = validatePassword;
window.showMockBanner    = showMockBanner;
window.openModal         = openModal;
window.closeModal        = closeModal;
window.initModals        = initModals;
window.debounce          = debounce;
