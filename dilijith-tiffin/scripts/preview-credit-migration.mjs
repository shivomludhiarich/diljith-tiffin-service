import fs from 'node:fs/promises';
import { previewMigration } from '../server/services/creditMigration.js';
// Accept an explicitly exported snapshot; never load .env or connect to production.
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/preview-credit-migration.mjs snapshot.json');
const snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
if (!Array.isArray(snapshot.subscriptions) || !Array.isArray(snapshot.mealRecords)) throw new Error('Snapshot requires subscriptions and mealRecords arrays.');
console.log(JSON.stringify(previewMigration(snapshot.subscriptions, snapshot.mealRecords), null, 2));
