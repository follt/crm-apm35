import type { IpcMain } from 'electron';
import { getDb } from '../db/database.js';
import type { Client } from '../db/schema.js';

export interface ClientPayload {
  type: 'particulier' | 'professionnel' | 'syndic';
  nom: string;
  prenom: string | null;
  raison_sociale: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  siret: string | null;
  notes: string | null;
}

export function registerClientsIpc(ipc: IpcMain): void {
  ipc.handle('clients:list', (): Client[] => {
    return getDb().prepare('SELECT * FROM clients ORDER BY nom').all() as Client[];
  });

  ipc.handle('clients:get', (_evt, id: number): Client => {
    const row = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined;
    if (!row) throw new Error(`Client ${id} introuvable`);
    return row;
  });

  ipc.handle('clients:create', (_evt, payload: ClientPayload): Client => {
    const result = getDb().prepare(`
      INSERT INTO clients (type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, siret, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.type, payload.nom, payload.prenom, payload.raison_sociale,
      payload.email, payload.telephone, payload.adresse, payload.code_postal, payload.ville,
      payload.siret, payload.notes,
    );
    return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid) as Client;
  });

  ipc.handle('clients:update', (_evt, id: number, payload: ClientPayload): Client => {
    getDb().prepare(`
      UPDATE clients SET
        type = ?, nom = ?, prenom = ?, raison_sociale = ?, email = ?, telephone = ?,
        adresse = ?, code_postal = ?, ville = ?, siret = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      payload.type, payload.nom, payload.prenom, payload.raison_sociale,
      payload.email, payload.telephone, payload.adresse, payload.code_postal, payload.ville,
      payload.siret, payload.notes, id,
    );
    return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client;
  });

  ipc.handle('clients:delete', (_evt, id: number) => {
    const used = getDb()
      .prepare('SELECT COUNT(*) as c FROM devis WHERE client_id = ? UNION ALL SELECT COUNT(*) as c FROM factures WHERE client_id = ?')
      .all(id, id) as Array<{ c: number }>;
    const total = used.reduce((sum, r) => sum + r.c, 0);
    if (total > 0) {
      throw new Error(`Impossible de supprimer : ce client a ${total} document(s) lié(s) (devis ou factures).`);
    }
    getDb().prepare('DELETE FROM clients WHERE id = ?').run(id);
    return { ok: true };
  });
}
