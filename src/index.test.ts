import { describe, it, expect, beforeEach } from 'vitest';
import WebSocket from 'ws';

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'ws://localhost:3000';

async function request(method: string, path: string, body: any = null, token: string | null = null) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (token) {
    // @ts-ignore
    options.headers['Authorization'] = `${token}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

function createWsConnection(token: string | null) {
  return new Promise<WebSocket>((resolve, reject) => {
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    const ws = new WebSocket(url);
    
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForWsMessage(ws: WebSocket, timeout = 3000) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket message timeout')), timeout);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function sendWsMessage(ws: WebSocket, event: string, data: any = {}) {
  ws.send(JSON.stringify({ event, data }));
}

function uniqueEmail(prefix = 'user') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
}

async function createTeacherAndLogin() {
  const email = uniqueEmail('teacher');
  await request('POST', '/auth/signup', {
    name: 'Test Teacher',
    email,
    password: 'password123',
    role: 'teacher'
  });
  const { data } = await request('POST', '/auth/login', { email, password: 'password123' });
  return { token: data.data.token, email };
}

async function createStudentAndLogin() {
  const email = uniqueEmail('student');
  const signupRes = await request('POST', '/auth/signup', {
    name: 'Test Student',
    email,
    password: 'password123',
    role: 'student'
  });
  const { data } = await request('POST', '/auth/login', { email, password: 'password123' });
  return { token: data.data.token, email, id: signupRes.data.data._id };
}

// ============================================
// AUTH TESTS - POST /auth/signup
// ============================================
describe('POST /auth/signup', () => {
  it('should create a new student user with correct response format', async () => {
    const email = uniqueEmail('student');
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'John Doe',
      email,
      password: 'password123',
      role: 'student'
    });

    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('_id');
    expect(data.data.name).toBe('John Doe');
    expect(data.data.email).toBe(email);
    expect(data.data.role).toBe('student');
    expect(data.data).not.toHaveProperty('password');
  });

  it('should create a new teacher user', async () => {
    const email = uniqueEmail('teacher');
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Jane Teacher',
      email,
      password: 'password123',
      role: 'teacher'
    });

    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe('teacher');
  });

  it('should return 400 for duplicate email', async () => {
    const email = uniqueEmail('duplicate');
    
    await request('POST', '/auth/signup', {
      name: 'First User',
      email,
      password: 'password123',
      role: 'student'
    });

    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Second User',
      email,
      password: 'password456',
      role: 'teacher'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Email already exists');
  });

  it('should return 400 for missing name', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      email: uniqueEmail(),
      password: 'password123',
      role: 'student'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for invalid email format', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: 'invalid-email',
      password: 'password123',
      role: 'student'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for password less than 6 characters', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: uniqueEmail(),
      password: '12345',
      role: 'student'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for invalid role', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: uniqueEmail(),
      password: 'password123',
      role: 'admin'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for missing role', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: uniqueEmail(),
      password: 'password123'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for missing password', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: uniqueEmail(),
      role: 'student'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for missing email', async () => {
    const { status, data } = await request('POST', '/auth/signup', {
      name: 'Test User',
      password: 'password123',
      role: 'student'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });
});

// ============================================
// AUTH TESTS - POST /auth/login
// ============================================
describe('POST /auth/login', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = uniqueEmail('logintest');
    await request('POST', '/auth/signup', {
      name: 'Test User',
      email: testEmail,
      password: 'password123',
      role: 'student'
    });
  });

  it('should login successfully and return JWT token', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'password123'
    });

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('token');
    expect(typeof data.data.token).toBe('string');
    expect(data.data.token.length).toBeGreaterThan(0);
  });

  it('should return 400 for wrong email', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: 'nonexistent@example.com',
      password: 'password123'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid email or password');
  });

  it('should return 400 for wrong password', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'wrongpassword'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid email or password');
  });

  it('should return 400 for invalid email format', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: 'invalid-email',
      password: 'password123'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for missing email', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      password: 'password123'
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 400 for missing password', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: testEmail
    });

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });
});

// ============================================
// AUTH TESTS - GET /auth/me
// ============================================
describe('GET /auth/me', () => {
  it('should return current user info for student', async () => {
    const { token, email } = await createStudentAndLogin();
    
    const { status, data } = await request('GET', '/auth/me', null, token);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('_id');
    expect(data.data.email).toBe(email);
    expect(data.data.role).toBe('student');
    expect(data.data).not.toHaveProperty('password');
  });

  it('should return current user info for teacher', async () => {
    const { token, email } = await createTeacherAndLogin();
    
    const { status, data } = await request('GET', '/auth/me', null, token);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe(email);
    expect(data.data.role).toBe('teacher');
  });

  it('should return 401 without token', async () => {
    const { status, data } = await request('GET', '/auth/me');

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });

  it('should return 401 with invalid token', async () => {
    const { status, data } = await request('GET', '/auth/me', null, 'invalid-token-here');

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });

  it('should return 401 with malformed Authorization header', async () => {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': 'sometoken'
      }
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });
});

// ============================================
// CLASS TESTS - POST /class
// ============================================
describe('POST /class', () => {
  it('should create a new class as teacher', async () => {
    const { token } = await createTeacherAndLogin();
    
    const { status, data } = await request('POST', '/class', {
      className: 'Math 101'
    }, token);

    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('_id');
    expect(data.data.className).toBe('Math 101');
    expect(data.data).toHaveProperty('teacherId');
    expect(data.data.studentIds).toEqual([]);
  });

  it('should return 403 when student tries to create class', async () => {
    const { token } = await createStudentAndLogin();
    
    const { status, data } = await request('POST', '/class', {
      className: 'Math 101'
    }, token);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, teacher access required');
  });

  it('should return 401 without token', async () => {
    const { status, data } = await request('POST', '/class', {
      className: 'Math 101'
    });

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });

  it('should return 400 for missing className', async () => {
    const { token } = await createTeacherAndLogin();
    
    const { status, data } = await request('POST', '/class', {}, token);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });
});

// ============================================
// CLASS TESTS - POST /class/:id/add-student
// ============================================
describe('POST /class/:id/add-student', () => {
  it('should add student to class', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', `/class/${classId}/add-student`, {
      studentId
    }, teacherToken);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.studentIds).toContain(studentId);
  });

  it('should not duplicate student if already in class', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    const { status, data } = await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);

    expect(status).toBe(200);
    expect(data.data.studentIds.filter((id: string) => id === studentId).length).toBe(1);
  });

  it('should return 403 when teacher does not own class', async () => {
    const { token: teacher1Token } = await createTeacherAndLogin();
    const { token: teacher2Token } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacher1Token);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', `/class/${classId}/add-student`, {
      studentId
    }, teacher2Token);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, not class teacher');
  });

  it('should return 403 when student tries to add student', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', `/class/${classId}/add-student`, {
      studentId
    }, studentToken);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, teacher access required');
  });

  it('should return 404 for non-existent class', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    const fakeClassId = '507f1f77bcf86cd799439011';

    const { status, data } = await request('POST', `/class/${fakeClassId}/add-student`, {
      studentId
    }, teacherToken);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Class not found');
  });

  it('should return 404 for non-existent student', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    const fakeStudentId = '507f1f77bcf86cd799439011';

    const { status, data } = await request('POST', `/class/${classId}/add-student`, {
      studentId: fakeStudentId
    }, teacherToken);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Student not found');
  });

  it('should return 400 for missing studentId', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', `/class/${classId}/add-student`, {}, teacherToken);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 401 without token', async () => {
    const { status, data } = await request('POST', '/class/someid/add-student', {
      studentId: 'someid'
    });

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });
});

// ============================================
// CLASS TESTS - GET /class/:id
// ============================================
describe('GET /class/:id', () => {
  it('should return class details for owning teacher', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);

    const { status, data } = await request('GET', `/class/${classId}`, null, teacherToken);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data._id).toBe(classId);
    expect(data.data.className).toBe('Math 101');
    expect(data.data.students).toHaveLength(1);
    expect(data.data.students[0]).toHaveProperty('_id');
    expect(data.data.students[0]).toHaveProperty('name');
    expect(data.data.students[0]).toHaveProperty('email');
  });

  it('should return class details for enrolled student', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);

    const { status, data } = await request('GET', `/class/${classId}`, null, studentToken);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.className).toBe('Math 101');
  });

  it('should return 403 for non-owning teacher', async () => {
    const { token: teacher1Token } = await createTeacherAndLogin();
    const { token: teacher2Token } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacher1Token);
    const classId = classRes.data.data._id;

    const { status, data } = await request('GET', `/class/${classId}`, null, teacher2Token);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, not class teacher');
  });

  it('should return 403 for non-enrolled student', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    const { status, data } = await request('GET', `/class/${classId}`, null, studentToken);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, not class teacher');
  });

  it('should return 404 for non-existent class', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const fakeClassId = '507f1f77bcf86cd799439011';

    const { status, data } = await request('GET', `/class/${fakeClassId}`, null, teacherToken);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Class not found');
  });

  it('should return 401 without token', async () => {
    const { status, data } = await request('GET', '/class/someid');

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });
});

// ============================================
// STUDENTS TESTS - GET /students
// ============================================
describe('GET /students', () => {
  it('should return all students for teacher', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    await createStudentAndLogin();
    await createStudentAndLogin();

    const { status, data } = await request('GET', '/students', null, teacherToken);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(2);
    expect(data.data[0]).toHaveProperty('_id');
    expect(data.data[0]).toHaveProperty('name');
    expect(data.data[0]).toHaveProperty('email');
    expect(data.data[0]).not.toHaveProperty('password');
  });

  it('should return 403 when student tries to get students', async () => {
    const { token: studentToken } = await createStudentAndLogin();

    const { status, data } = await request('GET', '/students', null, studentToken);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, teacher access required');
  });

  it('should return 401 without token', async () => {
    const { status, data } = await request('GET', '/students');

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });
});

// ============================================
// ATTENDANCE HTTP TESTS - POST /attendance/start
// ============================================
describe('POST /attendance/start', () => {
  it('should start attendance session', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', '/attendance/start', { classId }, teacherToken);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.classId).toBe(classId);
    expect(data.data).toHaveProperty('startedAt');
    expect(new Date(data.data.startedAt).toISOString()).toBe(data.data.startedAt);
  });

  it('should return 403 when teacher does not own class', async () => {
    const { token: teacher1Token } = await createTeacherAndLogin();
    const { token: teacher2Token } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacher1Token);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', '/attendance/start', { classId }, teacher2Token);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, not class teacher');
  });

  it('should return 403 when student tries to start attendance', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;

    const { status, data } = await request('POST', '/attendance/start', { classId }, studentToken);

    expect(status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forbidden, teacher access required');
  });

  it('should return 404 for non-existent class', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const fakeClassId = '507f1f77bcf86cd799439011';

    const { status, data } = await request('POST', '/attendance/start', { classId: fakeClassId }, teacherToken);

    expect(status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Class not found');
  });

  it('should return 400 for missing classId', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();

    const { status, data } = await request('POST', '/attendance/start', {}, teacherToken);

    expect(status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request schema');
  });

  it('should return 401 without token', async () => {
    const { status, data } = await request('POST', '/attendance/start', { classId: 'someid' });

    expect(status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized, token missing or invalid');
  });
});

// ============================================
// WEBSOCKET TESTS - Connection
// ============================================
describe('WebSocket - Connection', () => {
  it('should connect with valid teacher token', async () => {
    const { token } = await createTeacherAndLogin();
    const ws = await createWsConnection(token);
    
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('should connect with valid student token', async () => {
    const { token } = await createStudentAndLogin();
    const ws = await createWsConnection(token);
    
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('should send error and close for invalid token', async () => {
    const ws = new WebSocket(`${WS_URL}?token=invalid-token`);
    
    const message = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(message.event).toBe('ERROR');
    expect(message.data.message).toBe('Unauthorized or invalid token');
    
    await new Promise((resolve) => {
      ws.on('close', resolve);
    });
  });

  it('should send error and close for missing token', async () => {
    const ws = new WebSocket(WS_URL);
    
    const message = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(message.event).toBe('ERROR');
    expect(message.data.message).toBe('Unauthorized or invalid token');
  });
});

// ============================================
// WEBSOCKET TESTS - ATTENDANCE_MARKED
// ============================================
describe('WebSocket - ATTENDANCE_MARKED', () => {
  it('should broadcast attendance when teacher marks present', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);
    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', {
      studentId,
      status: 'present'
    });

    const teacherMsg = await waitForWsMessage(teacherWs);
    const studentMsg = await waitForWsMessage(studentWs);

    expect(teacherMsg.event).toBe('ATTENDANCE_MARKED');
    expect(teacherMsg.data.studentId).toBe(studentId);
    expect(teacherMsg.data.status).toBe('present');

    expect(studentMsg.event).toBe('ATTENDANCE_MARKED');
    expect(studentMsg.data.status).toBe('present');

    teacherWs.close();
    studentWs.close();
  });

  it('should broadcast attendance when teacher marks absent', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', {
      studentId,
      status: 'absent'
    });

    const msg = await waitForWsMessage(teacherWs);
    expect(msg.data.status).toBe('absent');

    teacherWs.close();
  });

  it('should return error when student tries to mark attendance', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(studentWs, 'ATTENDANCE_MARKED', {
      studentId,
      status: 'present'
    });

    const msg = await waitForWsMessage(studentWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('Forbidden, teacher event only');

    studentWs.close();
  });

  it('should return error when no active session', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', {
      studentId,
      status: 'present'
    });

    const msg = await waitForWsMessage(teacherWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('No active attendance session');

    teacherWs.close();
  });
});

// ============================================
// WEBSOCKET TESTS - TODAY_SUMMARY
// ============================================
describe('WebSocket - TODAY_SUMMARY', () => {
  it('should broadcast summary with correct counts', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: student1Id } = await createStudentAndLogin();
    const { id: student2Id } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId: student1Id }, teacherToken);
    await request('POST', `/class/${classId}/add-student`, { studentId: student2Id }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', { studentId: student1Id, status: 'present' });
    await waitForWsMessage(teacherWs);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', { studentId: student2Id, status: 'absent' });
    await waitForWsMessage(teacherWs);

    sendWsMessage(teacherWs, 'TODAY_SUMMARY');
    const summaryMsg = await waitForWsMessage(teacherWs);

    expect(summaryMsg.event).toBe('TODAY_SUMMARY');
    expect(summaryMsg.data.present).toBe(1);
    expect(summaryMsg.data.absent).toBe(1);
    expect(summaryMsg.data.total).toBe(2);

    teacherWs.close();
  });

  it('should broadcast summary to all connected clients', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);
    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(teacherWs, 'TODAY_SUMMARY');

    const teacherMsg = await waitForWsMessage(teacherWs);
    const studentMsg = await waitForWsMessage(studentWs);

    expect(teacherMsg.event).toBe('TODAY_SUMMARY');
    expect(studentMsg.event).toBe('TODAY_SUMMARY');

    teacherWs.close();
    studentWs.close();
  });

  it('should return error when student tries to request summary', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(studentWs, 'TODAY_SUMMARY');

    const msg = await waitForWsMessage(studentWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('Forbidden, teacher event only');

    studentWs.close();
  });

  it('should return error when no active session', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'TODAY_SUMMARY');

    const msg = await waitForWsMessage(teacherWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('No active attendance session');

    teacherWs.close();
  });

  it('should return zeros when no attendance marked yet', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'TODAY_SUMMARY');

    const msg = await waitForWsMessage(teacherWs);
    expect(msg.data.present).toBe(0);
    expect(msg.data.absent).toBe(0);
    expect(msg.data.total).toBe(0);

    teacherWs.close();
  });
});

// ============================================
// WEBSOCKET TESTS - MY_ATTENDANCE
// ============================================
describe('WebSocket - MY_ATTENDANCE', () => {
  it('should return "not yet updated" when attendance not marked', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(studentWs, 'MY_ATTENDANCE');

    const msg = await waitForWsMessage(studentWs);
    expect(msg.event).toBe('MY_ATTENDANCE');
    expect(msg.data.status).toBe('not yet updated');

    studentWs.close();
  });

  it('should return status when attendance is marked', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);
    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', { studentId, status: 'present' });
    await waitForWsMessage(teacherWs);
    await waitForWsMessage(studentWs);

    sendWsMessage(studentWs, 'MY_ATTENDANCE');

    const msg = await waitForWsMessage(studentWs);
    expect(msg.event).toBe('MY_ATTENDANCE');
    expect(msg.data.status).toBe('present');

    teacherWs.close();
    studentWs.close();
  });

  it('should only send response to requesting student (unicast)', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: student1Token, id: student1Id } = await createStudentAndLogin();
    const { token: student2Token, id: student2Id } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId: student1Id }, teacherToken);
    await request('POST', `/class/${classId}/add-student`, { studentId: student2Id }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const student1Ws = await createWsConnection(student1Token);
    const student2Ws = await createWsConnection(student2Token);

    sendWsMessage(student1Ws, 'MY_ATTENDANCE');

    const msg = await waitForWsMessage(student1Ws);
    expect(msg.event).toBe('MY_ATTENDANCE');

    await expect(waitForWsMessage(student2Ws, 500)).rejects.toThrow('WebSocket message timeout');

    student1Ws.close();
    student2Ws.close();
  });

  it('should return error when teacher tries MY_ATTENDANCE', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'MY_ATTENDANCE');

    const msg = await waitForWsMessage(teacherWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('Forbidden, student event only');

    teacherWs.close();
  });

  it('should return error when no active session', async () => {
    const { token: studentToken } = await createStudentAndLogin();

    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(studentWs, 'MY_ATTENDANCE');

    const msg = await waitForWsMessage(studentWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('No active attendance session');

    studentWs.close();
  });
});

// ============================================
// WEBSOCKET TESTS - DONE
// ============================================
describe('WebSocket - DONE', () => {
  it('should persist attendance and broadcast final summary', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: student1Id } = await createStudentAndLogin();
    const { id: student2Id } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId: student1Id }, teacherToken);
    await request('POST', `/class/${classId}/add-student`, { studentId: student2Id }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', { studentId: student1Id, status: 'present' });
    await waitForWsMessage(teacherWs);

    sendWsMessage(teacherWs, 'DONE');
    const doneMsg = await waitForWsMessage(teacherWs);

    expect(doneMsg.event).toBe('DONE');
    expect(doneMsg.data.message).toBe('Attendance persisted');
    expect(doneMsg.data.present).toBe(1);
    expect(doneMsg.data.absent).toBe(1);
    expect(doneMsg.data.total).toBe(2);

    teacherWs.close();

    const attendanceRes = await request('GET', `/class/${classId}/my-attendance`, null, studentToken);
    expect(attendanceRes.data.data.status).toBe('present');
  });

  it('should mark all unmarked students as absent', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: student1Id } = await createStudentAndLogin();
    const { id: student2Id } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId: student1Id }, teacherToken);
    await request('POST', `/class/${classId}/add-student`, { studentId: student2Id }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'DONE');
    const doneMsg = await waitForWsMessage(teacherWs);

    expect(doneMsg.data.present).toBe(0);
    expect(doneMsg.data.absent).toBe(2);
    expect(doneMsg.data.total).toBe(2);

    teacherWs.close();
  });

  it('should broadcast DONE to all connected clients', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);
    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(teacherWs, 'DONE');

    const teacherMsg = await waitForWsMessage(teacherWs);
    const studentMsg = await waitForWsMessage(studentWs);

    expect(teacherMsg.event).toBe('DONE');
    expect(studentMsg.event).toBe('DONE');

    teacherWs.close();
    studentWs.close();
  });

  it('should clear active session after DONE', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'DONE');
    await waitForWsMessage(teacherWs);

    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', { studentId, status: 'present' });
    const errorMsg = await waitForWsMessage(teacherWs);

    expect(errorMsg.event).toBe('ERROR');
    expect(errorMsg.data.message).toBe('No active attendance session');

    teacherWs.close();
  });

  it('should return error when student tries DONE', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();
    const { token: studentToken, id: studentId } = await createStudentAndLogin();
    
    const classRes = await request('POST', '/class', { className: 'Math 101' }, teacherToken);
    const classId = classRes.data.data._id;
    await request('POST', `/class/${classId}/add-student`, { studentId }, teacherToken);
    await request('POST', '/attendance/start', { classId }, teacherToken);

    const studentWs = await createWsConnection(studentToken);

    sendWsMessage(studentWs, 'DONE');

    const msg = await waitForWsMessage(studentWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('Forbidden, teacher event only');

    studentWs.close();
  });

  it('should return error when no active session', async () => {
    const { token: teacherToken } = await createTeacherAndLogin();

    const teacherWs = await createWsConnection(teacherToken);

    sendWsMessage(teacherWs, 'DONE');

    const msg = await waitForWsMessage(teacherWs);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('No active attendance session');

    teacherWs.close();
  });
});

// ============================================
// WEBSOCKET TESTS - Unknown Event
// ============================================
describe('WebSocket - Error Handling', () => {
  it('should return error for unknown event', async () => {
    const { token } = await createTeacherAndLogin();
    const ws = await createWsConnection(token);

    sendWsMessage(ws, 'UNKNOWN_EVENT', {});

    const msg = await waitForWsMessage(ws);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('Unknown event');

    ws.close();
  });

  it('should return error for invalid message format', async () => {
    const { token } = await createTeacherAndLogin();
    const ws = await createWsConnection(token);

    ws.send('not valid json');

    const msg = await waitForWsMessage(ws);
    expect(msg.event).toBe('ERROR');
    expect(msg.data.message).toBe('Invalid message format');

    ws.close();
  });
});

// ============================================
// END-TO-END FLOW TEST
// ============================================
describe('End-to-End Attendance Flow', () => {
  it('should complete full attendance workflow', async () => {
    // 1. Teacher signs up
    const teacherEmail = uniqueEmail('prof');
    const teacherSignup = await request('POST', '/auth/signup', {
      name: 'Prof. Smith',
      email: teacherEmail,
      password: 'teacher123',
      role: 'teacher'
    });
    expect(teacherSignup.status).toBe(201);

    // 2. Students sign up
    const student1Email = uniqueEmail('alice');
    const student1Signup = await request('POST', '/auth/signup', {
      name: 'Alice',
      email: student1Email,
      password: 'student123',
      role: 'student'
    });
    expect(student1Signup.status).toBe(201);

    const student2Email = uniqueEmail('bob');
    const student2Signup = await request('POST', '/auth/signup', {
      name: 'Bob',
      email: student2Email,
      password: 'student123',
      role: 'student'
    });
    expect(student2Signup.status).toBe(201);

    // 3. Teacher logs in
    const teacherLogin = await request('POST', '/auth/login', {
      email: teacherEmail,
      password: 'teacher123'
    });
    expect(teacherLogin.status).toBe(200);
    const teacherToken = teacherLogin.data.data.token;

    // 4. Student 1 logs in
    const student1Login = await request('POST', '/auth/login', {
      email: student1Email,
      password: 'student123'
    });
    const student1Token = student1Login.data.data.token;

    // 5. Teacher creates class
    const classCreate = await request('POST', '/class', {
      className: 'Computer Science 101'
    }, teacherToken);
    expect(classCreate.status).toBe(201);
    const classId = classCreate.data.data._id;

    // 6. Teacher adds students to class
    await request('POST', `/class/${classId}/add-student`, {
      studentId: student1Signup.data.data._id
    }, teacherToken);

    await request('POST', `/class/${classId}/add-student`, {
      studentId: student2Signup.data.data._id
    }, teacherToken);

    // 7. Teacher starts attendance session
    const startAttendance = await request('POST', '/attendance/start', {
      classId: classId
    }, teacherToken);
    expect(startAttendance.status).toBe(200);

    // 8. Connect WebSockets
    const teacherWs = await createWsConnection(teacherToken);
    const studentWs = await createWsConnection(student1Token);

    // 9. Teacher marks Alice present
    sendWsMessage(teacherWs, 'ATTENDANCE_MARKED', {
      studentId: student1Signup.data.data._id,
      status: 'present'
    });
    await waitForWsMessage(teacherWs);
    await waitForWsMessage(studentWs);

    // 10. Alice checks her attendance via WebSocket
    sendWsMessage(studentWs, 'MY_ATTENDANCE');
    const myAttendanceMsg = await waitForWsMessage(studentWs);
    expect(myAttendanceMsg.data.status).toBe('present');

    // 11. Teacher gets summary
    sendWsMessage(teacherWs, 'TODAY_SUMMARY');
    const summaryMsg = await waitForWsMessage(teacherWs);
    await waitForWsMessage(studentWs); // student also receives broadcast
    expect(summaryMsg.data.present).toBe(1);
    expect(summaryMsg.data.absent).toBe(0);
    expect(summaryMsg.data.total).toBe(1);

    // 12. Teacher finishes session
    sendWsMessage(teacherWs, 'DONE');
    const doneMsg = await waitForWsMessage(teacherWs);
    expect(doneMsg.data.present).toBe(1);
    expect(doneMsg.data.absent).toBe(1); // Bob auto-marked absent
    expect(doneMsg.data.total).toBe(2);

    // 13. Alice checks her persisted attendance via HTTP
    const myAttendanceHttp = await request('GET', `/class/${classId}/my-attendance`, null, student1Token);
    expect(myAttendanceHttp.data.data.status).toBe('present');

    teacherWs.close();
    studentWs.close();
  });
});
