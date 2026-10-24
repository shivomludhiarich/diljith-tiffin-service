import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Ensure Atlas DNS resolution
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

import { connectDB } from '../server/config/db.js';
import User from '../server/models/User.js';
import Subscription from '../server/models/Subscription.js';
import MealRecord from '../server/models/MealRecord.js';
import CreditAdjustment from '../server/models/CreditAdjustment.js';
import Activity from '../server/models/Activity.js';
import { addDays, endDateFor, todayStr } from '../src/utils/dates.js';

async function seedRealData() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  const today = todayStr(); // 2026-10-19
  console.log(`[Seed] Target reference date: ${today}`);

  console.log('[Seed] Cleaning up old demo accounts, test users, and related collections...');
  await Subscription.deleteMany({});
  await MealRecord.deleteMany({});
  await CreditAdjustment.deleteMany({});
  await Activity.deleteMany({});
  await User.deleteMany({});

  console.log('[Seed] Database wiped clean.');
  const adminPasswordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 10);
  // Shivom's original password hash from existing account
  const shivomPasswordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 10);

  // 1. Create Dilijith Admin
  const admin = await User.create({
    name: 'Dilijith Admin',
    email: 'admin@dilijithtiffin.com',
    phone: '+919999999999',
    password: adminPasswordHash,
    role: 'admin',
    status: 'Active',
    notes: 'Primary administrator for Dilijith Tiffin Service',
  });
  console.log(`[Seed] Created Admin: ${admin.name} (${admin.phone})`);

  // 2. Real Customer List
  const customersData = [
    {
      id: 'u-shivom',
      name: 'Shivom Ludhiarich',
      phone: '+916230730355',
      email: 'shivom@gmail.com',
      password: shivomPasswordHash,
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Flat 402, Block C, Silver Oak Apartments',
        street: '12th Main Road, HAL 2nd Stage',
        area: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'India',
      },
      plan: {
        code: 'SUB-1001',
        months: 1,
        meals: ['lunch'],
        offset: -9, // Started 2026-10-10
        alloc: 30,
      },
    },
    {
      id: 'u-priya',
      name: 'Priya Sharma',
      phone: '+919845012345',
      email: 'priya.sharma@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Apartment 304, Prestige Ozone',
        street: 'Whitefield Main Road',
        area: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560066',
        country: 'India',
      },
      plan: {
        code: 'SUB-1002',
        months: 1,
        meals: ['lunch', 'dinner'],
        offset: -14, // Started 2026-10-05
        alloc: 60,
      },
    },
    {
      id: 'u-rohan',
      name: 'Rohan Mehta',
      phone: '+919871023456',
      email: 'rohan.mehta@outlook.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Villa 12, Green Glen Layout',
        street: 'Outer Ring Road',
        area: 'Bellandur',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560103',
        country: 'India',
      },
      plan: {
        code: 'SUB-1003',
        months: 1,
        meals: ['breakfast', 'lunch', 'dinner'],
        offset: -21, // Started 2026-09-28 (Expiring soon)
        alloc: 90,
      },
    },
    {
      id: 'u-ananya',
      name: 'Ananya Iyer',
      phone: '+919940134567',
      email: 'ananya.iyer@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Flat 502, Sobha Daisy',
        street: '14th Main Road',
        area: 'HSR Layout Sector 4',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560102',
        country: 'India',
      },
      plan: {
        code: 'SUB-1004',
        months: 3,
        meals: ['lunch'],
        offset: -48, // Started 2026-09-01
        alloc: 90,
      },
    },
    {
      id: 'u-vikram',
      name: 'Vikramaditya Reddy',
      phone: '+919731245678',
      email: 'vikram.reddy@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'House #45, 5th Cross',
        street: '6th Block',
        area: 'Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560095',
        country: 'India',
      },
      plan: {
        code: 'SUB-1005',
        months: 1,
        meals: ['dinner'],
        offset: -7, // Started 2026-10-12
        alloc: 30,
      },
    },
    {
      id: 'u-meera',
      name: 'Meera Nair',
      phone: '+919847356789',
      email: 'meera.nair@yahoo.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Flat 201, Brigade Millennium',
        street: 'Puttenahalli Road',
        area: 'JP Nagar 7th Phase',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560078',
        country: 'India',
      },
      plan: {
        code: 'SUB-1006',
        months: 1,
        meals: ['breakfast', 'lunch'],
        offset: -18, // Started 2026-10-01
        alloc: 60,
      },
    },
    {
      id: 'u-rahul',
      name: 'Rahul Verma',
      phone: '+919811467890',
      email: 'rahul.verma@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Tower B-1104, Salarpuria Sattva Greenage',
        street: 'Hosur Road',
        area: 'Bommanahalli',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560068',
        country: 'India',
      },
      plan: {
        code: 'SUB-1007',
        months: 1,
        meals: ['lunch'],
        offset: -11, // Started 2026-10-08
        alloc: 30,
      },
    },
    {
      id: 'u-sneha',
      name: 'Sneha Kulkarni',
      phone: '+919820578901',
      email: 'sneha.kulkarni@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Flat 103, Ferns Paradise',
        street: 'Outer Ring Road',
        area: 'Marathahalli',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560037',
        country: 'India',
      },
      plan: {
        code: 'SUB-1008',
        months: 1,
        meals: ['lunch', 'dinner'],
        offset: -4, // Started 2026-10-15
        alloc: 60,
      },
    },
    {
      id: 'u-karthik',
      name: 'Karthik Nambiar',
      phone: '+919741689012',
      email: 'karthik.nambiar@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'House 88, 2nd Cross',
        street: 'Cambridge Layout',
        area: 'Ulsoor',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560008',
        country: 'India',
      },
      plan: {
        code: 'SUB-1009',
        months: 3,
        meals: ['breakfast'],
        offset: -65, // Started 2026-08-15
        alloc: 90,
      },
    },
    {
      id: 'u-divya',
      name: 'Divya Menon',
      phone: '+919884790123',
      email: 'divya.menon@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Flat 6B, Golden Palms',
        street: '100 Feet Road',
        area: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'India',
      },
      plan: {
        code: 'SUB-1010',
        months: 1,
        meals: ['lunch'],
        offset: -27, // Started 2026-09-22 (Expiring in 2 days!)
        alloc: 30,
      },
    },
    {
      id: 'u-amit',
      name: 'Amit Patel',
      phone: '+919825801234',
      email: 'amit.patel@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: {
        houseOrFlat: 'Flat 408, Godrej Woodsman Estate',
        street: 'Bellary Road',
        area: 'Hebbal',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560024',
        country: 'India',
      },
      plan: {
        code: 'SUB-1011',
        months: 1,
        meals: ['dinner'],
        offset: -18,
        alloc: 30,
        cancelled: true,
        cancelReason: 'Relocated to Mumbai',
      },
    },
    {
      id: 'u-neha',
      name: 'Neha Agarwal',
      phone: '+919830912345',
      email: 'neha.agarwal@gmail.com',
      password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
      role: 'user',
      status: 'Active',
      address: null, // Intentionally null so admin dashboard "Missing addresses" alert has an authentic case
      plan: null,
    },
  ];

  let recCounter = 1000;
  const allMealDocs = [];

  for (const c of customersData) {
    const userDoc = await User.create({
      name: c.name,
      phone: c.phone,
      email: c.email,
      password: c.password,
      role: c.role,
      status: c.status,
      address: c.address,
    });

    console.log(`[Seed] Created User: ${c.name} (${c.phone}) - ${c.address ? 'Address OK' : 'Missing Address'}`);

    if (c.plan) {
      const p = c.plan;
      const startDate = addDays(today, p.offset);
      const endDate = endDateFor(startDate, p.months);

      const subDoc = await Subscription.create({
        subCode: p.code,
        user: userDoc._id,
        mealTypes: p.meals,
        durationMonths: p.months,
        startDate,
        endDate,
        allocatedMeals: p.alloc,
        consumedMeals: 0,
        approvedAdjustments: 0,
        status: p.cancelled ? 'Cancelled' : 'Active',
        cancelledAt: p.cancelled ? new Date('2026-10-14T10:00:00.000Z') : null,
        cancelReason: p.cancelReason || '',
      });

      // Generate meal records for this plan
      let count = 0;
      let consumed = 0;
      for (let d = startDate; d <= endDate && count < p.alloc; d = addDays(d, 1)) {
        for (const mealType of p.meals) {
          if (count >= p.alloc) break;
          count++;

          let status = 'Scheduled';
          let cancelledAt = null;
          let cancelledBy = null;

          if (d < today) {
            // Past meals: mostly consumed, occasional cancellation
            if (count % 13 === 0) {
              status = 'Cancelled';
              cancelledAt = new Date(`${addDays(d, -1)}T18:00:00.000Z`);
              cancelledBy = 'user';
            } else {
              status = 'Consumed';
              consumed++;
            }
          } else if (p.cancelled) {
            status = 'Cancelled';
            cancelledAt = subDoc.cancelledAt;
            cancelledBy = 'admin';
          } else {
            status = 'Scheduled';
          }

          allMealDocs.push({
            recordCode: `MR-${++recCounter}`,
            user: userDoc._id,
            subscription: subDoc._id,
            mealType,
            date: d,
            status,
            cancelledAt,
            cancelledBy,
          });
        }
      }

      subDoc.consumedMeals = consumed;
      await subDoc.save();

      await Activity.create({
        type: 'allocated',
        label: 'Subscription allocated',
        userId: userDoc._id.toString(),
        userName: userDoc.name,
        subscriptionId: p.code,
        detail: `${p.months} month(s), ${p.meals.join('+')}, ${p.alloc} meals from ${startDate} to ${endDate}`,
        createdAt: new Date(`${startDate}T10:00:00.000Z`),
      });
    }
  }

  // Insert all meal records
  console.log(`[Seed] Inserting ${allMealDocs.length} meal records...`);
  await MealRecord.insertMany(allMealDocs);

  // Add 1 or 2 recent activities
  await Activity.create({
    type: 'renewal',
    label: 'Subscription renewed',
    userId: 'u-ananya',
    userName: 'Ananya Iyer',
    subscriptionId: 'SUB-1004',
    detail: 'Plan extended by 1 month for lunch',
    createdAt: new Date('2026-10-18T14:30:00.000Z'),
  });

  await Activity.create({
    type: 'adjustment',
    label: 'Credit adjusted',
    userId: 'u-rohan',
    userName: 'Rohan Mehta',
    subscriptionId: 'SUB-1003',
    detail: 'Added 2 complimentary meal credits (goodwill)',
    createdAt: new Date('2026-10-19T09:15:00.000Z'),
  });

  console.log('[Seed] Seeding completed successfully!');
  process.exit(0);
}

seedRealData().catch((err) => {
  console.error('[Seed] Error seeding data:', err);
  process.exit(1);
});
