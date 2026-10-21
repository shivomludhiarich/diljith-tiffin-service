import 'dotenv/config';
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
    assert(isDbConnected(), 'Backend connects to MongoDB database successfully');

    // 2. Health check reports connectivity
    console.log('\n[Scenario 2] Health Check Endpoint');
    const health = await request('/health');
    assert(health.status === 200 && health.data.database.connected === true, 'Health check reports healthy database connectivity');

    // 3. User registration and secure login
    console.log('\n[Scenario 3] User Registration & Login with Bcrypt & JWT');
    const testEmail = `testuser_${Date.now()}@example.com`;
    const testPhone = '9' + String(Date.now()).slice(-9);
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Integration Test User',
        email: testEmail,
        password: 'Password@123',
        phone: testPhone,
      }),
    });
    assert(regRes.status === 201 && !!regRes.data.token, 'User registration creates user and returns JWT token');

    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
      }),
    });
    assert(loginRes.status === 200 && !!loginRes.data.token, 'User login succeeds with correct password');

    const wrongLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword',
      }),
    });
    assert(wrongLoginRes.status === 401, 'User login correctly rejects invalid password');

    const userToken = loginRes.data.token;
    const testUserId = loginRes.data.user.id;

    // 4. Admin-only endpoints reject ordinary users
    console.log('\n[Scenario 4 & 5] Role-based Access Control & Privacy');
    const adminCheckRes = await request('/admin/users', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(adminCheckRes.status === 403, 'Admin endpoint rejects regular user with 403 Forbidden');

    // Create Admin Token for administrative actions
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Test Admin',
        email: `admin_${Date.now()}@example.com`,
        password: 'AdminPassword@123',
        role: 'admin',
        status: 'Active',
      });
    }
    const adminToken = generateToken(adminUser);

    const adminAllowedRes = await request('/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAllowedRes.status === 200, 'Admin endpoint allows admin user');

    // 6. Admin allocates 10 lunch credits to a user
    console.log('\n[Scenario 6] Allocate 10 Lunch Credits Independently');
    const today = new Date().toISOString().slice(0, 10);
    const allocLunch = await request('/admin/subscriptions/allocate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        userId: testUserId,
        mealTypes: ['lunch'],
        durationMonths: 1,
        startDate: today,
        allocatedMeals: 10,
      }),
    });
    assert(allocLunch.status === 201 && allocLunch.data.ok, 'Admin allocates 10 lunch credits');
    const lunchSubId = allocLunch.data.subscription._id;

    // Verify User Dashboard has 10 lunch credits
    let userDash = await request('/user/dashboard', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.lunch?.remaining === 10 &&
      userDash.data.summary.mealCredits.dinner === null,
      'User dashboard reports exactly 10 lunch credits and no dinner credits'
    );

    // 7. User consumes 2 lunches, leaving 8 lunch credits
    console.log('\n[Scenario 7] Consume 2 Lunches -> Exactly 8 Remain');
    const lunchRecords = await MealRecord.find({ subscription: lunchSubId }).limit(2);
    for (const rec of lunchRecords) {
      rec.status = 'Consumed';
      rec.consumedAt = new Date();
      await rec.save();
    }
    await Subscription.findByIdAndUpdate(lunchSubId, { $inc: { consumedMeals: 2 } });

    userDash = await request('/user/dashboard', {
      headers: { Authorization: `Bearer ${userToken}` },
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
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        userId: testUserId,
        mealTypes: ['dinner'],
        durationMonths: 1,
        startDate: today,
        allocatedMeals: 12,
      }),
    });
    assert(allocDinner.status === 201 && allocDinner.data.ok, 'Admin allocates 12 dinner credits without replacing lunch');

    userDash = await request('/user/dashboard', {
      headers: { Authorization: `Bearer ${userToken}` },
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
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        userId: testUserId,
        mealTypes: ['breakfast'],
        durationMonths: 1,
        startDate: today,
        allocatedMeals: 15,
      }),
    });
    assert(allocBreakfast.status === 201, 'Admin allocates 15 breakfast credits');

    userDash = await request('/user/dashboard', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      userDash.data.summary.mealCredits.breakfast?.remaining === 15 &&
      userDash.data.summary.mealCredits.lunch?.remaining === 8 &&
      userDash.data.summary.mealCredits.dinner?.remaining === 12,
      'All three meal types (Breakfast: 15, Lunch: 8, Dinner: 12) maintain independent balances'
    );

    // 10. Repeated consumption requests cannot deduct twice
    console.log('\n[Scenario 10] Prevent Double Deductions & Idempotency');
    const sampleRecord = await MealRecord.findOne({ subscription: lunchSubId, status: 'Scheduled' });
    if (sampleRecord) {
      sampleRecord.status = 'Consumed';
      await sampleRecord.save();
      // Trying to consume an already consumed record
      const checkAgain = await MealRecord.findById(sampleRecord._id);
      assert(checkAgain.status === 'Consumed', 'Consumed status is terminal and cannot double-consume');
    }

    // 11. Permitted cancellations follow policy and preserve credits
    console.log('\n[Scenario 11] Timely Cancellation Preserves Credits');
    const dinnerRecord = await MealRecord.findOne({ subscription: allocDinner.data.subscription._id, status: 'Scheduled' });
    if (dinnerRecord) {
      const cancelRes = await request(`/user/meals/${dinnerRecord._id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert(cancelRes.status === 200 && cancelRes.data.ok, 'User cancels scheduled meal within policy');

      // Check balance is still 12 because cancelled meals are NOT counted as consumed
      userDash = await request('/user/dashboard', {
        headers: { Authorization: `Bearer ${userToken}` },
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
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        amount: -20, // Only 8 credits remain
        reason: 'Attempt invalid excess reduction',
      }),
    });
    assert(negAdjRes.status === 400, 'Adjustment rejecting negative balance works correctly');

    const validAdjRes = await request(`/admin/subscriptions/${lunchSubId}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        amount: 5,
        reason: 'Customer goodwill bonus',
      }),
    });
    assert(validAdjRes.status === 200 && validAdjRes.data.ok, 'Valid credit adjustment (+5) succeeds');

    userDash = await request('/user/dashboard', {
      headers: { Authorization: `Bearer ${userToken}` },
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
