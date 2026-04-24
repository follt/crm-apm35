import type { IpcMain } from 'electron';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/database.js';
import { secrets } from '../services/secrets.js';
import { testEmailConnection } from '../services/email.service.js';

export interface EntrepriseConfig {
  raison_sociale: string;
  forme_juridique: string;
  siret: string | null;
  tva_intracommunautaire: string | null;
  rcs: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  iban: string | null;
  bic: string | null;
  conditions_generales: string | null;
  mentions_legales: string | null;
}

export interface EmailConfigPayload {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password?: string;
  email_from: string;
  signature_html: string;
}

export interface EmailConfigView extends Omit<EmailConfigPayload, 'smtp_password'> {
  has_password: boolean;
}

export function registerConfigIpc(ipc: IpcMain): void {
  ipc.handle('config:get-entreprise', (): EntrepriseConfig => {
    const row = getDb().prepare('SELECT * FROM configuration WHERE id = 1').get() as EntrepriseConfig | undefined;
    if (!row) throw new Error('Configuration entreprise introuvable');
    return row;
  });

  ipc.handle('config:update-entreprise', (_evt, payload: EntrepriseConfig) => {
    getDb().prepare(`
      UPDATE configuration SET
        raison_sociale = ?, forme_juridique = ?, siret = ?, tva_intracommunautaire = ?,
        rcs = ?, adresse = ?, code_postal = ?, ville = ?, telephone = ?, email = ?,
        iban = ?, bic = ?, conditions_generales = ?, mentions_legales = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      payload.raison_sociale, payload.forme_juridique, payload.siret, payload.tva_intracommunautaire,
      payload.rcs, payload.adresse, payload.code_postal, payload.ville, payload.telephone, payload.email,
      payload.iban, payload.bic, payload.conditions_generales, payload.mentions_legales,
    );
    return { ok: true };
  });

  ipc.handle('config:get-email', (): EmailConfigView => {
    const row = getDb().prepare(`
      SELECT smtp_host, smtp_port, smtp_secure, smtp_user, email_from, signature_html
      FROM email_config WHERE id = 1
    `).get() as {
      smtp_host: string | null;
      smtp_port: number | null;
      smtp_secure: number;
      smtp_user: string | null;
      email_from: string | null;
      signature_html: string | null;
    } | undefined;

    return {
      smtp_host: row?.smtp_host ?? 'smtp.gmail.com',
      smtp_port: row?.smtp_port ?? 587,
      smtp_secure: row?.smtp_secure === 1,
      smtp_user: row?.smtp_user ?? '',
      email_from: row?.email_from ?? '',
      signature_html: row?.signature_html ?? '',
      has_password: secrets.hasSmtpPassword(),
    };
  });

  ipc.handle('config:update-email', (_evt, payload: EmailConfigPayload) => {
    getDb().prepare(`
      UPDATE email_config SET
        smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?,
        email_from = ?, signature_html = ?
      WHERE id = 1
    `).run(
      payload.smtp_host,
      payload.smtp_port,
      payload.smtp_secure ? 1 : 0,
      payload.smtp_user,
      payload.email_from,
      payload.signature_html,
    );

    if (payload.smtp_password && payload.smtp_password.length > 0) {
      secrets.setSmtpPassword(payload.smtp_password);
    }
    return { ok: true, has_password: secrets.hasSmtpPassword() };
  });

  ipc.handle('email:test', async (_evt, to: string) => {
    return testEmailConnection(to);
  });

  ipc.handle('config:upload-logo', (_evt, payload: { name: string; data: Uint8Array }) => {
    const ext = path.extname(payload.name).toLowerCase() || '.png';
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      throw new Error('Format non supporté (PNG, JPG, JPEG uniquement)');
    }
    const assetsDir = path.join(app.getPath('userData'), 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const destPath = path.join(assetsDir, `logo${ext}`);
    fs.writeFileSync(destPath, Buffer.from(payload.data));

    for (const other of ['.png', '.jpg', '.jpeg']) {
      const p = path.join(assetsDir, `logo${other}`);
      if (other !== ext && fs.existsSync(p)) fs.unlinkSync(p);
    }

    getDb().prepare('UPDATE configuration SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(destPath);
    return { path: destPath };
  });

  ipc.handle('config:delete-logo', () => {
    const row = getDb().prepare('SELECT logo_path FROM configuration WHERE id = 1').get() as { logo_path: string | null };
    if (row.logo_path && fs.existsSync(row.logo_path)) {
      try { fs.unlinkSync(row.logo_path); } catch { /* ignore */ }
    }
    getDb().prepare('UPDATE configuration SET logo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
    return { ok: true };
  });

  ipc.handle('config:get-logo-data-url', () => {
    const row = getDb().prepare('SELECT logo_path FROM configuration WHERE id = 1').get() as { logo_path: string | null };
    if (!row.logo_path || !fs.existsSync(row.logo_path)) return null;
    const ext = path.extname(row.logo_path).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const bytes = fs.readFileSync(row.logo_path);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  });

  ipc.handle('config:upload-icon', (_evt, payload: { name: string; data: Uint8Array }) => {
    const ext = path.extname(payload.name).toLowerCase() || '.png';
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      throw new Error('Format non supporté (PNG, JPG uniquement)');
    }
    const assetsDir = path.join(app.getPath('userData'), 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    const destPath = path.join(assetsDir, `icon${ext}`);
    fs.writeFileSync(destPath, Buffer.from(payload.data));
    for (const other of ['.png', '.jpg', '.jpeg']) {
      const p = path.join(assetsDir, `icon${other}`);
      if (other !== ext && fs.existsSync(p)) fs.unlinkSync(p);
    }
    getDb().prepare('UPDATE configuration SET icon_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(destPath);
    return { path: destPath };
  });

  ipc.handle('config:delete-icon', () => {
    const row = getDb().prepare('SELECT icon_path FROM configuration WHERE id = 1').get() as { icon_path: string | null };
    if (row.icon_path && fs.existsSync(row.icon_path)) {
      try { fs.unlinkSync(row.icon_path); } catch { /* ignore */ }
    }
    getDb().prepare('UPDATE configuration SET icon_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
    return { ok: true };
  });

  ipc.handle('config:get-icon-data-url', () => {
    const row = getDb().prepare('SELECT icon_path FROM configuration WHERE id = 1').get() as { icon_path: string | null };
    if (!row.icon_path || !fs.existsSync(row.icon_path)) return null;
    const ext = path.extname(row.icon_path).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const bytes = fs.readFileSync(row.icon_path);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  });

  ipc.handle('data:reset-business', (_evt, opts: { alsoCatalogue?: boolean } = {}) => {
    const db = getDb();
    const wipe = db.transaction(() => {
      db.exec('DELETE FROM relances');
      db.exec('DELETE FROM factures_lignes');
      db.exec('DELETE FROM factures');
      db.exec('DELETE FROM devis_lignes');
      db.exec('DELETE FROM devis');
      db.exec('DELETE FROM clients');
      if (opts.alsoCatalogue) db.exec('DELETE FROM catalogue');
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('clients', 'devis', 'devis_lignes', 'factures', 'factures_lignes', 'relances', 'catalogue')");
    });
    wipe();
    return { ok: true };
  });
}
