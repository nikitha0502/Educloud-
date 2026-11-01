/**
 * api.js — API layer.
 * Routes calls to MockDB (USE_MOCK=true) or real AWS API Gateway (USE_MOCK=false).
 */

const API = (() => {

  // ─── Session ─────────────────────────────────────────────────────────────
  // Use localStorage as primary so login persists across pages opened from file://
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(APP_CONFIG.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setCurrentUser(user, token, remember = false) {
    const payload = JSON.stringify(user);
    localStorage.setItem(APP_CONFIG.SESSION_KEY, payload);
    localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
  }

  function clearSession() {
    localStorage.removeItem(APP_CONFIG.SESSION_KEY);
    localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
  }

  function getToken() {
    return localStorage.getItem(APP_CONFIG.TOKEN_KEY);
  }

  // Resolve the correct login page path regardless of how deep we are
  function _loginPath(fallback) {
    // If we're in /pages/, login.html is a sibling
    if (window.location.href.includes('/pages/') || window.location.href.includes('\\pages\\')) {
      return 'login.html';
    }
    return fallback || 'pages/login.html';
  }

  function requireAuth(redirectPath) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = _loginPath(redirectPath);
      return null;
    }
    return user;
  }

  function requireRole(role, redirectPath) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = _loginPath(redirectPath);
      return null;
    }
    if (user.role !== role) {
      // Redirect to the correct dashboard instead of blocking
      if (user.role === 'faculty') {
        window.location.href = 'faculty-dashboard.html';
      } else {
        window.location.href = 'student-dashboard.html';
      }
      return null;
    }
    return user;
  }

  // ─── Real HTTP helper ─────────────────────────────────────────────────────
  async function http(method, path, body = null) {
    const token = getToken();
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${APP_CONFIG.AWS.API_GATEWAY_URL}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API error');
    return data;
  }

  // ─── Simulated network delay for mock ─────────────────────────────────────
  function delay(ms = 350) { return new Promise(r => setTimeout(r, ms)); }

  // ─── AUTH API ─────────────────────────────────────────────────────────────
  const Auth = {
    async register(payload) {
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Auth.register(payload); }
      return http('POST', '/auth/register', payload);
    },
    async login(email, password) {
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Auth.login({ email, password }); }
      return http('POST', '/auth/login', { email, password });
    },
    async getProfile(userId) {
      if (APP_CONFIG.USE_MOCK) { await delay(150); return MockDB.Auth.getProfile(userId); }
      return http('GET', `/auth/profile/${userId}`);
    },
    async updateProfile(userId, updates) {
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Auth.updateProfile(userId, updates); }
      return http('PUT', `/auth/profile/${userId}`, updates);
    },
    async resetPassword(email, newPassword) {
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Auth.resetPassword(email, newPassword); }
      return http('POST', '/auth/reset-password', { email, newPassword });
    },
    async changePassword(userId, currentPassword, newPassword) {
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Auth.changePassword(userId, currentPassword, newPassword); }
      return http('POST', '/auth/change-password', { userId, currentPassword, newPassword });
    },
  };

  // ─── ASSIGNMENTS API ───────────────────────────────────────────────────────
  const Assignments = {
    async create(payload) {
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Assignments.create(payload); }
      return http('POST', '/assignments', payload);
    },
    async getAll() {
      if (APP_CONFIG.USE_MOCK) { await delay(200); return MockDB.Assignments.getAll(); }
      return http('GET', '/assignments');
    },
    async getById(id) {
      if (APP_CONFIG.USE_MOCK) { await delay(150); return MockDB.Assignments.getById(id); }
      return http('GET', `/assignments/${id}`);
    },
    async getByFaculty(facultyId) {
      if (APP_CONFIG.USE_MOCK) { await delay(200); return MockDB.Assignments.getByFaculty(facultyId); }
      return http('GET', `/assignments?facultyId=${facultyId}`);
    },
    async update(id, updates) {
      const user = getCurrentUser();
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Assignments.update(id, user.userId, updates); }
      return http('PUT', `/assignments/${id}`, updates);
    },
    async delete(id) {
      const user = getCurrentUser();
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Assignments.delete(id, user.userId); }
      return http('DELETE', `/assignments/${id}`);
    },
  };

  // ─── SUBMISSIONS API ───────────────────────────────────────────────────────
  const Submissions = {
    async submit(payload) {
      if (APP_CONFIG.USE_MOCK) { await delay(500); return MockDB.Submissions.submit(payload); }
      return http('POST', '/submissions', payload);
    },
    async getByStudent(studentId) {
      if (APP_CONFIG.USE_MOCK) { await delay(200); return MockDB.Submissions.getByStudent(studentId); }
      return http('GET', `/submissions?studentId=${studentId}`);
    },
    async getByAssignment(assignmentId) {
      if (APP_CONFIG.USE_MOCK) { await delay(200); return MockDB.Submissions.getByAssignment(assignmentId); }
      return http('GET', `/submissions?assignmentId=${assignmentId}`);
    },
    async getByFaculty(facultyId) {
      if (APP_CONFIG.USE_MOCK) { await delay(200); return MockDB.Submissions.getByFaculty(facultyId); }
      return http('GET', `/submissions?facultyId=${facultyId}`);
    },
    async getById(id) {
      if (APP_CONFIG.USE_MOCK) { await delay(150); return MockDB.Submissions.getById(id); }
      return http('GET', `/submissions/${id}`);
    },
    async addGrade(submissionId, gradeData) {
      const user = getCurrentUser();
      if (APP_CONFIG.USE_MOCK) { await delay(); return MockDB.Submissions.addGrade(submissionId, user.userId, gradeData); }
      return http('PUT', `/submissions/${submissionId}/grade`, gradeData);
    },
  };

  // ─── FILES API ─────────────────────────────────────────────────────────────
  const Files = {
    async getUploadUrl(fileName, contentType) {
      if (APP_CONFIG.USE_MOCK) { await delay(100); return MockDB.Files.getUploadUrl(fileName, contentType); }
      return http('POST', '/files/upload-url', { fileName, contentType });
    },
    async getDownloadUrl(fileKey, fileName) {
      if (APP_CONFIG.USE_MOCK) { await delay(100); return MockDB.Files.getDownloadUrl(fileKey, fileName); }
      return http('POST', '/files/download-url', { fileKey });
    },
    async uploadToS3(presignedUrl, file, fileKey) {
      if (APP_CONFIG.USE_MOCK) {
        await delay(600);
        if (window.MockDB && window.MockDB.Files && window.MockDB.Files.saveUploadedFile) {
          await window.MockDB.Files.saveUploadedFile(fileKey || presignedUrl, file);
        }
        return true;
      }
      const res = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      return res.ok;
    },
  };

  // ─── STATS API ─────────────────────────────────────────────────────────────
  const Stats = {
    async forStudent(studentId) {
      if (APP_CONFIG.USE_MOCK) { await delay(100); return MockDB.Stats.forStudent(studentId); }
      return http('GET', `/stats/student/${studentId}`);
    },
    async forFaculty(facultyId) {
      if (APP_CONFIG.USE_MOCK) { await delay(100); return MockDB.Stats.forFaculty(facultyId); }
      return http('GET', `/stats/faculty/${facultyId}`);
    },
  };

  return { getCurrentUser, setCurrentUser, clearSession, getToken, requireAuth, requireRole, Auth, Assignments, Submissions, Files, Stats };
})();

window.API = API;
