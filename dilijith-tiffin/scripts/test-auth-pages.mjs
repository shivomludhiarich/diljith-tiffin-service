import 'dotenv/config';
if (!process.env.TEST_MONGODB_URI || !/^dts_test_/.test(process.env.TEST_MONGODB_DB_NAME || '')) throw new Error('Use an isolated TEST_MONGODB_URI and dts_test_ database.');
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = process.env.TEST_MONGODB_DB_NAME;
import mongoose from 'mongoose';
import { connectDB } from '../server/config/db.js';
import User from '../server/models/User.js';
import app from '../server/app.js';
import http from 'http';
import bcrypt from 'bcryptjs';

let server;
let baseUrl;

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runAuthTests() {
  console.log('\n--- Dilijith Tiffin Service: Auth & Registration Test Suite ---');

  // Start HTTP server on ephemeral port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    await connectDB();

    // 1. Register with valid details
    console.log('\n[Test 1] Register with valid details');
    const validPhone = '9876543210';
    const validAddress = {
      houseOrFlat: 'Flat 402, Block B',
      street: 'Main Market Road',
      area: 'Sector 14',
      city: 'Gurugram',
      state: 'Haryana',
      postalCode: '122001',
      country: 'India',
    };
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Anita Roy',
        phone: validPhone,
        password: 'SecretPassword@123',
        confirmPassword: 'SecretPassword@123',
        countryCode: '+91',
        address: validAddress,
      }),
    });
    assert(regRes.status === 201 && regRes.data.ok, 'User successfully registered with 201 Created');
    assert(regRes.data?.user?.phone === `+91${validPhone}`, 'Phone number normalized to +91<digits>');
    assert(!!regRes.data.token, 'JWT authentication token issued upon registration');

    // 2. Verify password is encrypted and not in plaintext in MongoDB
    console.log('\n[Test 2] Password Hashing & Data Integrity');
    const createdDoc = await User.findById(regRes.data.user.id).select('+password');
    assert(createdDoc.password !== 'SecretPassword@123', 'Password is not stored in plaintext');
    assert(createdDoc.password.startsWith('$2'), 'Password is encrypted using bcrypt');
    const isMatch = await bcrypt.compare('SecretPassword@123', createdDoc.password);
    assert(isMatch === true, 'Bcrypt compares correctly with the plaintext password');

    // 3. Reject invalid phone numbers
    console.log('\n[Test 3] Phone Number Validation');
    const invalidLenRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Phone',
        phone: '12345',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        address: validAddress,
      }),
    });
    assert(invalidLenRes.status === 400, 'Rejects short phone number with 400 Bad Request');

    const invalidPrefixRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Prefix',
        phone: '1234567890', // Indian numbers start with 6,7,8,9
        password: 'Password@123',
        confirmPassword: 'Password@123',
        address: validAddress,
      }),
    });
    assert(invalidPrefixRes.status === 400, 'Rejects invalid Indian mobile prefix with 400 Bad Request');

    // 4. Reject mismatched passwords
    console.log('\n[Test 4] Password Matching Validation');
    const mismatchRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Mismatch User',
        phone: '9876543211',
        password: 'Password@123',
        confirmPassword: 'DifferentPassword@123',
        address: validAddress,
      }),
    });
    assert(mismatchRes.status === 400 && mismatchRes.data.field === 'confirmPassword', 'Rejects mismatched passwords');

    // 5. Reject duplicate phone numbers
    console.log('\n[Test 5] Duplicate Phone Number Prevention');
    const dupRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Attempt',
        phone: validPhone, // Already registered in Test 1
        password: 'Password@123',
        confirmPassword: 'Password@123',
        address: validAddress,
      }),
    });
    assert(dupRes.status === 409, 'Rejects duplicate phone registration with 409 Conflict');

    // 6. Log in with correct credentials
    console.log('\n[Test 6] Login with Phone & Password');
    const loginSuccess = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        phone: validPhone,
        password: 'SecretPassword@123',
      }),
    });
    assert(loginSuccess.status === 200 && loginSuccess.data.ok, 'Login succeeds with 200 OK');
    assert(loginSuccess.data.user.role === 'user', 'Authenticated user role is user');

    // 7. Reject incorrect passwords with generic message
    console.log('\n[Test 7] Reject Incorrect Password with Generic Message');
    const badPassRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        phone: validPhone,
        password: 'WrongPassword',
      }),
    });
    assert(badPassRes.status === 401, 'Rejects wrong password with 401 Unauthorized');
    assert(
      badPassRes.data.message === 'Invalid phone number or password.',
      'Returns generic error message without enumerating accounts'
    );

    // 8. Reject attempts to register as administrator
    console.log('\n[Test 8] Prevent Privilege Escalation in Registration');
    const hackerPhone = '8' + String(Date.now() + 500).slice(-9);
    const hackerReg = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Wannabe Admin',
        phone: hackerPhone,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'admin', // Malicious attempt to self-promote
        address: validAddress,
      }),
    });
    if (hackerReg.status !== 201) {
      console.log('hackerReg failed with status:', hackerReg.status, hackerReg.data);
    }
    assert(hackerReg.status === 201, 'Registration succeeds');
    assert(hackerReg.data?.user?.role === 'user', 'Server strictly assigns role: "user" and ignores requested "admin"');

    // 9. Protect private endpoints & require authentication
    console.log('\n[Test 9] Protected Route Gating');
    const unauthRes = await request('/user/dashboard');
    assert(unauthRes.status === 401, 'Unauthenticated user rejected from user dashboard with 401');

    const adminUnauth = await request('/admin/users');
    assert(adminUnauth.status === 401, 'Unauthenticated user rejected from admin routes with 401');

    const userToken = loginSuccess.data.token;
    const adminForbidden = await request('/admin/users', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(adminForbidden.status === 403, 'Regular user rejected from admin routes with 403 Forbidden');

    console.log('\n-----------------------------------------------------------');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('-----------------------------------------------------------\n');

  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuthTests().catch((err) => {
  console.error('Fatal auth test error:', err);
  process.exit(1);
});
