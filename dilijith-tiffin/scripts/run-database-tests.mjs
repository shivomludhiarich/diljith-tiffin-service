import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
try {
  for (const script of process.argv.slice(2).length ? process.argv.slice(2) : ['test-auth-pages.mjs', 'test-mongodb-integration.mjs']) {
    const dbName = `dts_test_${randomUUID().replaceAll('-', '')}`;
    const env = { ...process.env, JWT_SECRET: randomUUID(), TEST_MONGODB_URI: replica.getUri(), TEST_MONGODB_DB_NAME: dbName, MONGODB_URI: replica.getUri(), MONGODB_DB_NAME: dbName };
    const child = spawn(process.execPath, [`scripts/${script}`], { env, stdio: 'inherit', windowsHide: true });
    const code = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    if (code !== 0) throw new Error(`${script} failed (${code})`);
  }
} finally { await replica.stop(); }
