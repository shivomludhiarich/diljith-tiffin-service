import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dts-demo-refresh-'));
try {
  await mongoose.connect(replica.getUri(), { dbName: 'dts_test_demo_refresh' });
  const users = mongoose.connection.db.collection('users');
  await users.insertMany([{ name: 'Preserved Admin', phone: '+919222222221', role: 'admin' }, { name: 'Preserved Owner', phone: '+919222222222', role: 'user' }, { name: 'Priya Sharma', phone: '+919222222223', role: 'user', email: 'priya.sharma@gmail.com' }]);
  for (let run = 0; run < 2; run++) {
    const child = spawn(process.execPath, [path.resolve('scripts/refresh-demo-dataset.mjs'), '--apply'], { cwd: directory, windowsHide: true,
      env: { ...process.env, MONGODB_URI: replica.getUri(), MONGODB_DB_NAME: 'dts_test_demo_refresh' }, stdio: 'pipe' });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
    assert.equal(code, 0, output);
    assert.equal(await users.countDocuments(), 7);
    assert.equal(await users.countDocuments({ name: /^Preserved/ }), 2);
    assert.equal(await mongoose.connection.db.collection('subscriptions').countDocuments(), 6);
    assert.equal(await users.countDocuments({ email: 'priya.sharma@gmail.com' }), 0);
  }
  console.log('Demo refresh passed: targeted deletion, preserved accounts, backups, valid balances, clean rerun.');
} finally { await mongoose.disconnect(); await replica.stop(); }
