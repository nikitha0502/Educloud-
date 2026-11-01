/**
 * mock-db.js — In-browser mock database using localStorage.
 * Simulates DynamoDB + Cognito + S3 for local development and demo.
 */

const MockDB = (() => {

  // ─── Storage Helpers ──────────────────────────────────────────────────────
  const get = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  };
  const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const getObj = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  };

  const KEYS = {
    USERS: 'mock_users',
    ASSIGNMENTS: 'mock_assignments',
    SUBMISSIONS: 'mock_submissions',
    FILES: 'mock_files',
  };

  // ─── Seed Data ────────────────────────────────────────────────────────────
  function seed() {
    if (localStorage.getItem('mock_seeded')) return;

    const now = new Date();
    const future1 = new Date(now.getTime() + 7  * 86400000).toISOString();
    const future2 = new Date(now.getTime() + 14 * 86400000).toISOString();
    const future3 = new Date(now.getTime() + 3  * 86400000).toISOString();
    const past1   = new Date(now.getTime() - 5  * 86400000).toISOString();

    const users = [
      { userId: 'faculty-001', name: 'Dr. Sarah Johnson', email: 'faculty@demo.com', password: 'Faculty@123', role: 'faculty', department: 'Computer Science', createdAt: now.toISOString() },
      { userId: 'student-001', name: 'Alex Thompson',     email: 'student@demo.com', password: 'Student@123', role: 'student', enrollmentId: 'CS2024001', createdAt: now.toISOString() },
      { userId: 'student-002', name: 'Maria Garcia',      email: 'maria@demo.com',   password: 'Student@123', role: 'student', enrollmentId: 'CS2024002', createdAt: now.toISOString() },
    ];
    set(KEYS.USERS, users);

    const assignments = [
      {
        assignmentId: 'asgn-001',
        title: 'Cloud Computing Architecture Design',
        description: 'Design a scalable cloud architecture for an e-commerce platform using AWS services. Include auto-scaling, load balancing, and disaster recovery strategies.',
        instructions: 'Submit a PDF with your architecture diagram, service justifications, and cost estimates. Minimum 10 pages.',
        facultyId: 'faculty-001',
        facultyName: 'Dr. Sarah Johnson',
        deadline: future1,
        createdAt: now.toISOString(),
        attachmentKey: 'assignment_docs/asgn-001-instructions.pdf',
        attachmentName: 'AWS_Architecture_Guide.pdf',
        totalMarks: 100,
        allowLate: false,
        status: 'active',
      },
      {
        assignmentId: 'asgn-002',
        title: 'Serverless Application Development',
        description: 'Build a serverless REST API using AWS Lambda and API Gateway with DynamoDB integration. Implement CRUD operations for a task management system.',
        instructions: 'Submit source code as ZIP and a report explaining your implementation.',
        facultyId: 'faculty-001',
        facultyName: 'Dr. Sarah Johnson',
        deadline: future2,
        createdAt: now.toISOString(),
        attachmentKey: null,
        attachmentName: null,
        totalMarks: 150,
        allowLate: true,
        status: 'active',
      },
      {
        assignmentId: 'asgn-003',
        title: 'Docker and Containerization Report',
        description: 'Write a detailed report on containerization concepts, Docker commands, and how containers differ from virtual machines.',
        instructions: 'Submit a PDF document. Include practical examples and diagrams.',
        facultyId: 'faculty-001',
        facultyName: 'Dr. Sarah Johnson',
        deadline: future3,
        createdAt: now.toISOString(),
        attachmentKey: null,
        attachmentName: null,
        totalMarks: 75,
        allowLate: false,
        status: 'active',
      },
      {
        assignmentId: 'asgn-004',
        title: 'DevOps Pipeline Implementation',
        description: 'Implement a CI/CD pipeline using GitHub Actions or AWS CodePipeline. Deploy a sample application automatically on each push.',
        instructions: 'Submit a GitHub repository link and a PDF report explaining your pipeline stages.',
        facultyId: 'faculty-001',
        facultyName: 'Dr. Sarah Johnson',
        deadline: past1,
        createdAt: new Date(now.getTime() - 20 * 86400000).toISOString(),
        attachmentKey: null,
        attachmentName: null,
        totalMarks: 100,
        allowLate: false,
        status: 'closed',
      },
    ];
    set(KEYS.ASSIGNMENTS, assignments);

    const submissions = [
      {
        submissionId: 'sub-001',
        assignmentId: 'asgn-001',
        studentId: 'student-002',
        studentName: 'Maria Garcia',
        fileKey: 'submissions/sub-001.pdf',
        fileName: 'Maria_Cloud_Architecture.pdf',
        fileSize: 2457600,
        submittedAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
        status: 'submitted',
        isLate: false,
        grade: null,
        feedback: null,
      },
      {
        submissionId: 'sub-002',
        assignmentId: 'asgn-004',
        studentId: 'student-001',
        studentName: 'Alex Thompson',
        fileKey: 'submissions/sub-002.pdf',
        fileName: 'Alex_DevOps_Report.pdf',
        fileSize: 1843200,
        submittedAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
        status: 'submitted',
        isLate: true,
        grade: 88,
        feedback: 'Good implementation but the CD stage needs improvement.',
      },
    ];
    set(KEYS.SUBMISSIONS, submissions);

    localStorage.setItem('mock_seeded', '1');
    console.log('[MockDB] Seeded with demo data.');
  }

  // ─── UUID ─────────────────────────────────────────────────────────────────
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  const Auth = {
    register({ name, email, password, role, department, enrollmentId }) {
      const users = get(KEYS.USERS);
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, message: 'An account with this email already exists.' };
      }
      if (password.length < 8) {
        return { success: false, message: 'Password must be at least 8 characters.' };
      }
      const user = {
        userId: `${role}-${uuid().slice(0, 8)}`,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role,
        department: department || null,
        enrollmentId: enrollmentId || null,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      set(KEYS.USERS, users);
      return { success: true, message: 'Registration successful!', user: sanitizeUser(user) };
    },

    login({ email, password }) {
      const users = get(KEYS.USERS);
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!user) return { success: false, message: 'Invalid email or password.' };
      const token = btoa(JSON.stringify({ userId: user.userId, role: user.role, exp: Date.now() + 86400000 }));
      return { success: true, token, user: sanitizeUser(user) };
    },

    getProfile(userId) {
      const users = get(KEYS.USERS);
      const user = users.find(u => u.userId === userId);
      if (!user) return { success: false, message: 'User not found.' };
      return { success: true, user: sanitizeUser(user) };
    },

    updateProfile(userId, updates) {
      const users = get(KEYS.USERS);
      const idx = users.findIndex(u => u.userId === userId);
      if (idx === -1) return { success: false, message: 'User not found.' };
      users[idx] = { ...users[idx], ...updates };
      set(KEYS.USERS, users);
      return { success: true, user: sanitizeUser(users[idx]) };
    },

    resetPassword(email, newPassword) {
      const users = get(KEYS.USERS);
      const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase().trim());
      if (!user) return { success: false, message: 'No account found with this email address.' };
      if (!newPassword || newPassword.length < 8) {
        return { success: false, message: 'Password must be at least 8 characters.' };
      }
      user.password = newPassword;
      set(KEYS.USERS, users);
      return { success: true, message: 'Password has been reset successfully.' };
    },

    changePassword(userId, currentPassword, newPassword) {
      const users = get(KEYS.USERS);
      const user = users.find(u => u.userId === userId);
      if (!user) return { success: false, message: 'User not found.' };
      if (user.password !== currentPassword) {
        return { success: false, message: 'Current password is incorrect.' };
      }
      if (!newPassword || newPassword.length < 8) {
        return { success: false, message: 'New password must be at least 8 characters.' };
      }
      user.password = newPassword;
      set(KEYS.USERS, users);
      return { success: true, message: 'Password changed successfully.' };
    },
  };

  function sanitizeUser(user) {
    const { password, ...safe } = user;
    return safe;
  }

  // ─── ASSIGNMENTS ──────────────────────────────────────────────────────────
  const Assignments = {
    create({ title, description, instructions, facultyId, facultyName, deadline, totalMarks, allowLate, attachmentName }) {
      const list = get(KEYS.ASSIGNMENTS);
      const asgn = {
        assignmentId: `asgn-${uuid().slice(0, 8)}`,
        title, description, instructions, facultyId, facultyName,
        deadline: new Date(deadline).toISOString(),
        totalMarks: parseInt(totalMarks) || 100,
        allowLate: !!allowLate,
        attachmentKey: attachmentName ? `assignment_docs/${uuid().slice(0, 8)}-${attachmentName}` : null,
        attachmentName: attachmentName || null,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      list.push(asgn);
      set(KEYS.ASSIGNMENTS, list);
      return { success: true, assignment: asgn };
    },

    getAll() {
      return { success: true, assignments: get(KEYS.ASSIGNMENTS) };
    },

    getById(assignmentId) {
      const list = get(KEYS.ASSIGNMENTS);
      const asgn = list.find(a => a.assignmentId === assignmentId);
      if (!asgn) return { success: false, message: 'Assignment not found.' };
      return { success: true, assignment: asgn };
    },

    getByFaculty(facultyId) {
      const list = get(KEYS.ASSIGNMENTS);
      return { success: true, assignments: list.filter(a => a.facultyId === facultyId) };
    },

    update(assignmentId, facultyId, updates) {
      const list = get(KEYS.ASSIGNMENTS);
      const idx = list.findIndex(a => a.assignmentId === assignmentId);
      if (idx === -1) return { success: false, message: 'Assignment not found.' };
      if (list[idx].facultyId !== facultyId) return { success: false, message: 'Unauthorized.' };
      list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
      set(KEYS.ASSIGNMENTS, list);
      return { success: true, assignment: list[idx] };
    },

    delete(assignmentId, facultyId) {
      const list = get(KEYS.ASSIGNMENTS);
      const target = list.find(a => a.assignmentId === assignmentId);
      if (!target) return { success: false, message: 'Assignment not found.' };
      if (target.facultyId !== facultyId) return { success: false, message: 'Unauthorized.' };
      set(KEYS.ASSIGNMENTS, list.filter(a => a.assignmentId !== assignmentId));
      return { success: true, message: 'Assignment deleted.' };
    },
  };

  // ─── SUBMISSIONS ──────────────────────────────────────────────────────────
  const Submissions = {
    submit({ assignmentId, studentId, studentName, fileKey, fileName, fileSize }) {
      const asgns = get(KEYS.ASSIGNMENTS);
      const asgn = asgns.find(a => a.assignmentId === assignmentId);
      if (!asgn) return { success: false, message: 'Assignment not found.' };

      const now = new Date();
      const deadline = new Date(asgn.deadline);
      const isLate = now > deadline;

      if (isLate && !asgn.allowLate) {
        return { success: false, message: 'Submission deadline has passed. Late submissions are not allowed for this assignment.' };
      }

      const key = fileKey || `submissions/${uuid().slice(0, 8)}.pdf`;
      const subs = get(KEYS.SUBMISSIONS);
      const existing = subs.find(s => s.assignmentId === assignmentId && s.studentId === studentId);
      if (existing) {
        // Update existing submission
        const idx = subs.findIndex(s => s.submissionId === existing.submissionId);
        subs[idx] = {
          ...subs[idx],
          fileKey: key,
          fileName,
          fileSize: fileSize || 0,
          submittedAt: now.toISOString(),
          status: 'submitted',
          isLate,
        };
        set(KEYS.SUBMISSIONS, subs);
        return { success: true, submission: subs[idx], updated: true };
      }

      const sub = {
        submissionId: `sub-${uuid().slice(0, 8)}`,
        assignmentId,
        studentId,
        studentName,
        fileKey: key,
        fileName,
        fileSize: fileSize || 0,
        submittedAt: now.toISOString(),
        status: 'submitted',
        isLate,
        grade: null,
        feedback: null,
      };
      subs.push(sub);
      set(KEYS.SUBMISSIONS, subs);
      return { success: true, submission: sub, updated: false };
    },

    getByStudent(studentId) {
      return { success: true, submissions: get(KEYS.SUBMISSIONS).filter(s => s.studentId === studentId) };
    },

    getByAssignment(assignmentId) {
      return { success: true, submissions: get(KEYS.SUBMISSIONS).filter(s => s.assignmentId === assignmentId) };
    },

    getByFaculty(facultyId) {
      const asgns = get(KEYS.ASSIGNMENTS).filter(a => a.facultyId === facultyId).map(a => a.assignmentId);
      return { success: true, submissions: get(KEYS.SUBMISSIONS).filter(s => asgns.includes(s.assignmentId)) };
    },

    getById(submissionId) {
      const sub = get(KEYS.SUBMISSIONS).find(s => s.submissionId === submissionId);
      if (!sub) return { success: false, message: 'Submission not found.' };
      return { success: true, submission: sub };
    },

    addGrade(submissionId, facultyId, { grade, feedback }) {
      const subs = get(KEYS.SUBMISSIONS);
      const idx = subs.findIndex(s => s.submissionId === submissionId);
      if (idx === -1) return { success: false, message: 'Submission not found.' };
      subs[idx] = { ...subs[idx], grade: parseInt(grade), feedback };
      set(KEYS.SUBMISSIONS, subs);
      return { success: true, submission: subs[idx] };
    },
  };

  // ─── FILES (in-browser mock storage + PDF generation) ───────────────────────
  const _fileStore = {};

  function generateSamplePdfDataUrl(title, subtitle) {
    const t = (title || 'EduCloud Document').replace(/[^\w\s-]/g, '');
    const s = (subtitle || 'CloudTech University Assignment System').replace(/[^\w\s-]/g, '');
    const stream = 'BT\n/F1 18 Tf\n50 720 Td\n(' + t + ') Tj\n/F1 12 Tf\n0 -30 Td\n(' + s + ') Tj\n/F1 10 Tf\n0 -25 Td\n(Securely generated and downloaded from EduCloud Platform - Student Assignment Management System) Tj\nET';
    const pdf = '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream\nendobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000360 00000 n \ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n441\n%%EOF';
    try {
      if (typeof btoa !== 'undefined') {
        return 'data:application/pdf;base64,' + btoa(pdf);
      }
      return 'data:application/pdf;base64,' + Buffer.from(pdf).toString('base64');
    } catch {
      return 'data:application/pdf;base64,' + Buffer.from(pdf).toString('base64');
    }
  }

  const Files = {
    getUploadUrl(fileName, contentType) {
      const fileId = uuid().slice(0, 8);
      const fileKey = `submissions/${fileId}-${fileName}`;
      const uploadUrl = `#mock-upload-${fileId}`;
      return {
        success: true,
        uploadUrl,
        fileKey,
      };
    },

    async saveUploadedFile(fileKey, file) {
      if (!file) return true;
      try {
        if (typeof FileReader !== 'undefined') {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              _fileStore[fileKey] = {
                dataUrl: reader.result,
                name: file.name,
                type: file.type || 'application/pdf',
                size: file.size
              };
              resolve(true);
            };
            reader.onerror = () => resolve(false);
            reader.readAsDataURL(file);
          });
        }
      } catch (e) {
        console.warn('saveUploadedFile fallback', e);
      }
      return true;
    },

    getDownloadUrl(fileKey, fileName) {
      const targetName = fileName || (fileKey ? fileKey.split('/').pop() : 'document.pdf');
      // If we have saved this file in memory, return its actual data URL
      for (const [k, v] of Object.entries(_fileStore)) {
        if (k === fileKey || k.includes(fileKey) || (fileKey && fileKey.includes(k)) || (v.name && v.name === targetName)) {
          return {
            success: true,
            downloadUrl: v.dataUrl,
            fileName: v.name || targetName,
          };
        }
      }
      // Otherwise return a genuine, valid downloadable PDF
      const pdfDataUrl = generateSamplePdfDataUrl(targetName, `Assignment File: ${fileKey || targetName}`);
      return {
        success: true,
        downloadUrl: pdfDataUrl,
        fileName: targetName.endsWith('.pdf') || targetName.endsWith('.docx') ? targetName : `${targetName}.pdf`,
      };
    },
  };

  // ─── STATS ────────────────────────────────────────────────────────────────
  const Stats = {
    forStudent(studentId) {
      const allAsgns = get(KEYS.ASSIGNMENTS);
      const mySubs   = get(KEYS.SUBMISSIONS).filter(s => s.studentId === studentId);
      const now = new Date();
      const active = allAsgns.filter(a => new Date(a.deadline) >= now);
      const submitted = mySubs.length;
      const pending = active.filter(a => !mySubs.find(s => s.assignmentId === a.assignmentId)).length;
      const overdue = allAsgns.filter(a => new Date(a.deadline) < now && !mySubs.find(s => s.assignmentId === a.assignmentId)).length;
      return { total: allAsgns.length, submitted, pending, overdue };
    },
    forFaculty(facultyId) {
      const myAsgns = get(KEYS.ASSIGNMENTS).filter(a => a.facultyId === facultyId);
      const myAsnIds = myAsgns.map(a => a.assignmentId);
      const subs = get(KEYS.SUBMISSIONS).filter(s => myAsnIds.includes(s.assignmentId));
      const students = new Set(get(KEYS.USERS).filter(u => u.role === 'student').map(u => u.userId)).size;
      return {
        totalAssignments: myAsgns.length,
        totalSubmissions: subs.length,
        totalStudents: students,
        pendingGrading: subs.filter(s => s.grade === null).length,
      };
    },
  };

  return { seed, Auth, Assignments, Submissions, Files, Stats };
})();

// Auto-seed on load
MockDB.seed();
window.MockDB = MockDB;
