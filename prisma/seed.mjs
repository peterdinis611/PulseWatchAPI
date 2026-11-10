import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const DEMO_EMAIL = 'demo@pulsewatch.dev';
const DEMO_PASSWORD = 'demo1234';
const DEMO_NAME = 'Demo';

function resolveSqlitePath(url) {
  if (!url?.startsWith('file:')) {
    throw new Error(`Unsupported DATABASE_URL: ${url ?? '(missing)'}`);
  }
  const withoutScheme = url.slice('file:'.length);
  if (withoutScheme.startsWith('/')) {
    return withoutScheme;
  }
  // Prisma relative paths are relative to prisma/schema.prisma → ../data/...
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  return join(root, withoutScheme.replace(/^\.\//, ''));
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const dbPath = resolveSqlitePath(process.env.DATABASE_URL);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const stamp = nowIso();

  const existing = db
    .prepare('SELECT id FROM User WHERE email = ?')
    .get(DEMO_EMAIL);

  let userId = existing?.id;
  if (userId) {
    db.prepare(
      'UPDATE User SET passwordHash = ?, name = ?, updatedAt = ? WHERE id = ?',
    ).run(passwordHash, DEMO_NAME, stamp, userId);
  } else {
    userId = randomUUID();
    db.prepare(
      `INSERT INTO User (id, email, passwordHash, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(userId, DEMO_EMAIL, passwordHash, DEMO_NAME, stamp, stamp);
  }

  const settings = db
    .prepare('SELECT userId FROM UserMonitorSettings WHERE userId = ?')
    .get(userId);
  if (!settings) {
    db.prepare(
      `INSERT INTO UserMonitorSettings
        (userId, defaultIntervalSec, defaultTimeoutMs, notifyOnDown, notifyOnRecover, createdAt, updatedAt)
       VALUES (?, 60, 10000, 1, 1, ?, ?)`,
    ).run(userId, stamp, stamp);
  }

  const monitors = [
    {
      name: 'PulseWatch API',
      type: 'HTTP',
      config: JSON.stringify({
        url: 'http://localhost:4000/health',
        method: 'GET',
        expectedStatus: 200,
      }),
      lastStatus: 'UP',
    },
    {
      name: 'Example.com',
      type: 'HTTP',
      config: JSON.stringify({
        url: 'https://example.com',
        method: 'GET',
        expectedStatus: 200,
      }),
      lastStatus: 'UP',
    },
    {
      name: 'DNS google.com',
      type: 'DNS',
      config: JSON.stringify({
        host: 'google.com',
        recordType: 'A',
      }),
      lastStatus: 'UNKNOWN',
    },
  ];

  const findMonitor = db.prepare(
    'SELECT id FROM Monitor WHERE userId = ? AND name = ?',
  );
  const insertMonitor = db.prepare(
    `INSERT INTO Monitor
      (id, userId, name, type, enabled, intervalSec, timeoutMs, config, lastStatus, alertsMuted, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, 60, 10000, ?, ?, 0, ?, ?)`,
  );
  const updateMonitor = db.prepare(
    `UPDATE Monitor
     SET type = ?, config = ?, enabled = 1, intervalSec = 60, timeoutMs = 10000, updatedAt = ?
     WHERE id = ?`,
  );

  for (const monitor of monitors) {
    const row = findMonitor.get(userId, monitor.name);
    if (row) {
      updateMonitor.run(monitor.type, monitor.config, stamp, row.id);
    } else {
      insertMonitor.run(
        randomUUID(),
        userId,
        monitor.name,
        monitor.type,
        monitor.config,
        monitor.lastStatus,
        stamp,
        stamp,
      );
    }
  }

  const unread = db
    .prepare(
      'SELECT COUNT(*) AS count FROM Notification WHERE userId = ? AND readAt IS NULL',
    )
    .get(userId).count;
  if (unread === 0) {
    db.prepare(
      `INSERT INTO Notification (id, userId, type, title, body, createdAt)
       VALUES (?, ?, 'INFO', ?, ?, ?)`,
    ).run(
      randomUUID(),
      userId,
      'Vitaj v demo flote',
      'Toto je demo účet. Monitory ukazujú HTTP health a example.com — skús Prehľad a zvonček.',
      stamp,
    );
  }

  db.close();

  console.log('Demo account ready:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  user id:  ${userId}`);
  console.log(`  database: ${dbPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
