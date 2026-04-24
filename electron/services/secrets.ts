import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function secretsPath(): string {
  return path.join(app.getPath('userData'), 'smtp_password.enc');
}

/**
 * One-shot migration from the old electron-store based secrets file to
 * Electron's `safeStorage` (backed by DPAPI on Windows / Keychain on macOS).
 * Silently no-ops if there is nothing to migrate.
 */
let migrationRan = false;
function migrateFromLegacy(): void {
  if (migrationRan) return;
  migrationRan = true;
  if (fs.existsSync(secretsPath())) return;
  if (!safeStorage.isEncryptionAvailable()) return;

  const userData = app.getPath('userData');
  const legacyKeyPath = path.join(userData, '.secrets-key');
  const legacyStorePath = path.join(userData, 'secrets.json');

  if (!fs.existsSync(legacyKeyPath) || !fs.existsSync(legacyStorePath)) {
    // Clean any leftover if only one exists
    try { if (fs.existsSync(legacyKeyPath)) fs.unlinkSync(legacyKeyPath); } catch { /* ignore */ }
    try { if (fs.existsSync(legacyStorePath)) fs.unlinkSync(legacyStorePath); } catch { /* ignore */ }
    return;
  }

  try {
    // Legacy format: electron-store v11 used AES-256-CBC with a random IV prefix.
    // Rather than decoding it ourselves, we require a one-off re-enter of the
    // password on first launch — safer than importing the legacy lib just for this.
    // Wipe the legacy files so subsequent launches skip this branch.
    try { fs.unlinkSync(legacyKeyPath); } catch { /* ignore */ }
    try { fs.unlinkSync(legacyStorePath); } catch { /* ignore */ }
    console.log('[secrets] Legacy store removed — user will need to re-enter SMTP password once.');
  } catch (e) {
    console.warn('[secrets] Legacy cleanup failed:', e);
  }
}

export const secrets = {
  getSmtpPassword(): string | undefined {
    migrateFromLegacy();
    const p = secretsPath();
    if (!fs.existsSync(p)) return undefined;
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    try {
      return safeStorage.decryptString(fs.readFileSync(p));
    } catch {
      return undefined;
    }
  },

  setSmtpPassword(password: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Le chiffrement sécurisé n'est pas disponible sur ce système. Impossible de stocker le mot de passe.");
    }
    const encrypted = safeStorage.encryptString(password);
    fs.writeFileSync(secretsPath(), encrypted, { mode: 0o600 });
  },

  clearSmtpPassword(): void {
    try { fs.unlinkSync(secretsPath()); } catch { /* ignore */ }
  },

  hasSmtpPassword(): boolean {
    migrateFromLegacy();
    return fs.existsSync(secretsPath());
  },
};
