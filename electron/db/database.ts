import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema.js';
import { seedDatabase } from './seed.js';
import { DEFAULT_RELANCE_N1, DEFAULT_RELANCE_N2, DEFAULT_RELANCE_N3 } from './relance-templates.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

  const dbPath = path.join(userDataPath, 'database.sqlite');
  const isFirstRun = !fs.existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA_SQL);
  runMigrations(db);

  if (isFirstRun) {
    console.log('First run detected — seeding database with demo data.');
    seedDatabase(db);
  }

  return db;
}

function runMigrations(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(configuration)").all() as Array<{ name: string }>;
  const hasIcon = cols.some((c) => c.name === 'icon_path');
  if (!hasIcon) {
    db.exec('ALTER TABLE configuration ADD COLUMN icon_path TEXT');
    console.log('Migration: added configuration.icon_path');
  }

  // Belt-and-suspenders: ensure single-row tables always have id=1 populated.
  // Prevents "Configuration entreprise introuvable" crashes in PDF / email services.
  db.prepare(`INSERT OR IGNORE INTO configuration (id, raison_sociale) VALUES (1, 'Mon entreprise')`).run();
  db.prepare(`INSERT OR IGNORE INTO email_config (id) VALUES (1)`).run();
  db.prepare(`
    INSERT OR IGNORE INTO relances_config (
      id, auto_enabled, delai_relance_1, delai_relance_2, delai_relance_3,
      template_niveau_1, template_niveau_2, template_niveau_3
    ) VALUES (1, 0, 7, 21, 45, ?, ?, ?)
  `).run(DEFAULT_RELANCE_N1, DEFAULT_RELANCE_N2, DEFAULT_RELANCE_N3);

  // One-shot bump: force-refresh relance templates for existing DBs that still
  // carry the old single-sentence defaults. Detected by a known marker in the
  // old niveau 3 template. Once bumped, never runs again.
  const current = db.prepare('SELECT template_niveau_3 FROM relances_config WHERE id = 1').get() as { template_niveau_3: string | null } | undefined;
  if (current?.template_niveau_3 && /Vous disposez de 8 jours pour régulariser, sinon procédure contentieuse/.test(current.template_niveau_3)) {
    db.prepare(`
      UPDATE relances_config SET
        template_niveau_1 = ?, template_niveau_2 = ?, template_niveau_3 = ?
      WHERE id = 1
    `).run(DEFAULT_RELANCE_N1, DEFAULT_RELANCE_N2, DEFAULT_RELANCE_N3);
    console.log('[migration] Relance templates upgraded to v2 (pro tone)');
  }

  // One-shot bump: rename leftover demo raison_sociale to "APM35" so existing
  // installs don't show "ARTISAN BTP SARL" or the bare "Mon entreprise" placeholder.
  const cfgNow = db.prepare('SELECT raison_sociale FROM configuration WHERE id = 1').get() as { raison_sociale: string | null } | undefined;
  if (cfgNow?.raison_sociale === 'ARTISAN BTP SARL' || cfgNow?.raison_sociale === 'Mon entreprise') {
    db.prepare('UPDATE configuration SET raison_sociale = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run('APM35');
    console.log('[migration] Default raison_sociale renamed to "APM35"');
  }
}
