import { randomUUID } from 'node:crypto';
import { todayStr, addDays } from '../src/utils/dates.js';
import 'dotenv/config';
if (!process.env.TEST_MONGODB_URI || !/^dts_test_/.test(process.env.TEST_MONGODB_DB_NAME || '')) throw new Error('Use an isolated TEST_MONGODB_URI and dts_test_ database.');
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = process.env.TEST_MONGODB_DB_NAME;
import mongoose from 'mongoose';
import { connectDB, isDbConnected } from '../server/config/db.js';
import User from '../server/models/User.js';
import Subscription from '../server/models/Subscription.js';
import MealRecord from '../server/models/MealRecord.js';
import CreditAdjustment from '../server/models/CreditAdjustment.js';
import { generateToken } from '../server/middleware/auth.js';
import app from '../server/app.js';
import http from 'http';

let server;
let baseUrl;

async function request(path, options = {}) {
  if (options.method === 'POST' && /subscriptions|meals/.test(path)) {
    const body = JSON.parse(options.body || '{}');
    body.opId ??= randomUUID();
    if (path.endsWith('/adjust')) body.mealType = 'lunch';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: 'http://localhost:5173', 'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, session: res.headers.get('set-cookie')?.split(';')[0].split('=')[1] };
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

async function runTests() {
  console.log('\n--- Dilijith Tiffin Service: MongoDB Integration Verification ---');

  // Start HTTP server on an ephemeral port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Backend connects to existing MongoDB database
    console.log('\n[Scenario 1] Database Connection');
    await connectDB();
  // Legacy explicit-consumption fixtures predate the automatic-accounting activation.
  await mongoose.connection.db.collection('mealaccountingpolicies').updateOne({ _id: 'automatic-consumption-v1' }, { $set: { activatedAt: new Date('2099-01-01') } }, { upsert: true });
    assert(isDbConnected(), 'Backend connects to MongoDB database successfully');

    // 2. Health check reports connectivity
    console.log('\n[Scenario 2] Health Check Endpoint');
    const health = await request('/health');
    assert(health.status === 200 && health.data.database.connected === true, 'Health check reports healthy database connectivity');

    // 3. User registration and secure login
    console.log('\n[Scenario 3] User Registration & Login with Bcrypt & JWT');
    const testEmail = `testuser_${Date.now()}@example.com`;
    const testPhone = '9876543212';
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Integration Test User',
        email: testEmail,
        password: 'Password@123',
        phone: testPhone,
        address: { houseOrFlat: '1', street: 'Test Road', city: 'Test City', state: 'Test State', postalCode: '110001' },
      }),
    });
    assert(regRes.status === 201 && !!regRes.session, 'User registration creates user and sets a session cookie');

    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
      }),
    });
    assert(loginRes.status === 200 && !!loginRes.session, 'User login succeeds with correct password');

    const wrongLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword',
      }),
    });
    assert(wrongLoginRes.status === 401, 'User login correctly rejects invalid password');

    const userToken = loginRes.session;
    const testUserId = loginRes.data.user.id;

    // 4. Admin-only endpoints reject ordinary users
    console.log('\n[Scenario 4 & 5] Role-based Access Control & Privacy');
    const adminCheckRes = await request('/admin/users', {
      headers: { Cookie: `__Host-dts-session=${userToken}` },
    });
    assert(adminCheckRes.status === 403, 'Admin endpoint rejects regular user with 403 Forbidden');

    // Create Admin Token for administrative actions
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Test Admin',
        phone: '9000000000',
        email: `admin_${Date.now()}@example.com`,
        password: 'AdminPassword@123',
        role: 'admin',
        status: 'Active',
      });
    }
    const adminToken = generateToken(adminUser);

    const adminAllowedRes = await request('/admin/users', {
      headers: { Cookie: `__Host-dts-session=${adminToken}` },
    });
    assert(adminAllowedRes.status === 200, 'Admin endpoint allows admin user');

    // 6. Admin allocates 10 lunch credits to a user
    console.log('\n[Scenario 6] Allocate 10 Lunch Credits Independently');
    const today = todayStr();
    const allocLunch = await request('/admin/subscriptions/allocate', {
      method: 'POST',
      headers: { Cookie: `__Host-dts-session=${adminToken}` },
      body: JSON.stringify({
        userId: testUserId,
        mealTypes: ['lunch'],
        durationMonths: 1,
        startDate: today,
        mealAllocations: { lunch: 10 },
      }),
    });
    assert(allocLunch.status === 201 && allocLunch.data.ok, 'Admin allocates 10 lunch credits');
    const lunchSubId = allocLunch.data.subscription._id;

    // Verify User Dashboard has 10 lunch credits
    let userDash = await request('/user/dashboard', {
      headers: { Cookie: `__Host-dts-session=${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.lunch?.remaining === 10 &&
      userDash.data.summary.mealCredits.dinner === null,
      'User dashboard reports exactly 10 lunch credits and no dinner credits'
    );

    // 7. User consumes 2 lunches, leaving 8 lunch credits
    console.log('\n[Scenario 7] Consume 2 Lunches -> Exactly 8 Remain');
    await Subscription.updateOne({ _id: lunchSubId }, { $set: { startDate: addDays(today, -1) } });
    const yesterday = await MealRecord.create({ user: testUserId, subscription: lunchSubId, mealType: 'lunch', date: addDays(today, -1), accountingVersion: 2 });
    const lunchRecords = [yesterday, await MealRecord.findOne({ subscription: lunchSubId, date: today })];
    for (const rec of lunchRecords) {
      const consumed = await request(`/admin/meals/${rec._id}/consume`, { method: 'POST', headers: { Cookie: `__Host-dts-session=${adminToken}` } });
      assert(consumed.data.ok, 'Delivery API consumes exactly one lunch');
    }

    userDash = await request('/user/dashboard', {
      headers: { Cookie: `__Host-dts-session=${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.lunch?.remaining === 8 &&
      userDash.data.summary.mealCredits.lunch?.consumed === 2,
      'Lunch has exactly 8 remaining credits after 2 are consumed'
    );

    // 8. Admin allocates 12 dinner credits -> Lunch must still have 8, Dinner must have 12
    console.log('\n[Scenario 8] Allocate 12 Dinner Credits -> Lunch Remains 8, Dinner is 12');
    const allocDinner = await request('/admin/subscriptions/allocate', {
      method: 'POST',
      headers: { Cookie: `__Host-dts-session=${adminToken}` },
      body: JSON.stringify({
        userId: testUserId,
        mealTypes: ['dinner'],
        durationMonths: 1,
        startDate: today,
        mealAllocations: { dinner: 12 },
      }),
    });
    assert(allocDinner.status === 201 && allocDinner.data.ok, 'Admin allocates 12 dinner credits without replacing lunch');

    userDash = await request('/user/dashboard', {
      headers: { Cookie: `__Host-dts-session=${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.lunch?.remaining === 8 &&
      userDash.data.summary.mealCredits.dinner?.remaining === 12,
      'Independent Accounting Verified: Lunch remains 8 and Dinner is 12'
    );

    // 9. Breakfast allocations/adjustments do not change lunch or dinner
    console.log('\n[Scenario 9] Independent Breakfast Allocation');
    const allocBreakfast = await request('/admin/subscriptions/allocate', {
      method: 'POST',
      headers: { Cookie: `__Host-dts-session=${adminToken}` },
      body: JSON.stringify({
        userId: testUserId,
        mealTypes: ['breakfast'],
        durationMonths: 1,
        startDate: today,
        mealAllocations: { breakfast: 15 },
      }),
    });
    assert(allocBreakfast.status === 201, 'Admin allocates 15 breakfast credits');

    userDash = await request('/user/dashboard', {
      headers: { Cookie: `__Host-dts-session=${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.breakfast?.remaining === 15 &&
      userDash.data.summary.mealCredits.lunch?.remaining === 8 &&
      userDash.data.summary.mealCredits.dinner?.remaining === 12,
      'All three meal types (Breakfast: 15, Lunch: 8, Dinner: 12) maintain independent balances'
    );

    // 10. Repeated consumption requests cannot deduct twice
    console.log('\n[Scenario 10] Prevent Double Deductions & Idempotency');
    const duplicate = await request(`/admin/meals/${lunchRecords[0]._id}/consume`, { method: 'POST', headers: { Cookie: `__Host-dts-session=${adminToken}` } });
    assert(duplicate.status === 409, 'Repeated consumption is rejected by the API');

    // 11. Permitted cancellations follow policy and preserve credits
    console.log('\n[Scenario 11] Timely Cancellation Preserves Credits');
    const dinnerRecord = await MealRecord.findOne({ subscription: allocDinner.data.subscription._id, date: addDays(today, 1), status: 'Scheduled' });
    if (dinnerRecord) {
      const cancelRes = await request(`/user/meals/${dinnerRecord._id}/cancel`, {
        method: 'POST',
        headers: { Cookie: `__Host-dts-session=${userToken}` },
      });
      assert(cancelRes.status === 200 && cancelRes.data.ok, 'User cancels scheduled meal within policy');

      // Check balance is still 12 because cancelled meals are NOT counted as consumed
      userDash = await request('/user/dashboard', {
        headers: { Cookie: `__Host-dts-session=${userToken}` },
      });
      assert(
        userDash.data.summary.mealCredits.dinner?.remaining === 12,
        'Cancellation preserves remaining dinner credits (12)'
      );
    }

    // 12. Adjustments validation
    console.log('\n[Scenario 12] Credit Adjustment Validation & Negative Balance Protection');
    const negAdjRes = await request(`/admin/subscriptions/${lunchSubId}/adjust`, {
      method: 'POST',
      headers: { Cookie: `__Host-dts-session=${adminToken}` },
      body: JSON.stringify({
        amount: -20, // Only 8 credits remain
        reason: 'Attempt invalid excess reduction',
      }),
    });
    assert(negAdjRes.status === 409, 'Adjustment rejecting negative balance works correctly');

    const validAdjRes = await request(`/admin/subscriptions/${lunchSubId}/adjust`, {
      method: 'POST',
      headers: { Cookie: `__Host-dts-session=${adminToken}` },
      body: JSON.stringify({
        amount: 5,
        reason: 'Customer goodwill bonus',
      }),
    });
    assert(validAdjRes.status === 200 && validAdjRes.data.ok, 'Valid credit adjustment (+5) succeeds');

    userDash = await request('/user/dashboard', {
      headers: { Cookie: `__Host-dts-session=${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.lunch?.remaining === 13,
      'Lunch remaining updated accurately: 8 + 5 = 13'
    );

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

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
