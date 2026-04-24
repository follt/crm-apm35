import type { IpcMain } from 'electron';
import { getDb } from '../db/database.js';
import type { CatalogueItem } from '../db/schema.js';

export interface CataloguePayload {
  categorie: 'placo' | 'isolation' | 'menuiserie' | 'main_oeuvre' | 'autre';
  designation: string;
  description: string | null;
  unite: 'm²' | 'm' | 'unité' | 'forfait' | 'heure';
  prix_ht: number;
  taux_tva: number;
  actif: boolean;
}

export function registerCatalogueIpc(ipc: IpcMain): void {
  ipc.handle('catalogue:list', (_evt, includeInactive = false): CatalogueItem[] => {
    const sql = includeInactive
      ? 'SELECT * FROM catalogue ORDER BY categorie, designation'
      : 'SELECT * FROM catalogue WHERE actif = 1 ORDER BY categorie, designation';
    return getDb().prepare(sql).all() as CatalogueItem[];
  });

  ipc.handle('catalogue:create', (_evt, payload: CataloguePayload): CatalogueItem => {
    const result = getDb().prepare(`
      INSERT INTO catalogue (categorie, designation, description, unite, prix_ht, taux_tva, actif)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.categorie, payload.designation, payload.description, payload.unite,
      payload.prix_ht, payload.taux_tva, payload.actif ? 1 : 0,
    );
    return getDb().prepare('SELECT * FROM catalogue WHERE id = ?').get(result.lastInsertRowid) as CatalogueItem;
  });

  ipc.handle('catalogue:update', (_evt, id: number, payload: CataloguePayload): CatalogueItem => {
    getDb().prepare(`
      UPDATE catalogue SET
        categorie = ?, designation = ?, description = ?, unite = ?,
        prix_ht = ?, taux_tva = ?, actif = ?
      WHERE id = ?
    `).run(
      payload.categorie, payload.designation, payload.description, payload.unite,
      payload.prix_ht, payload.taux_tva, payload.actif ? 1 : 0, id,
    );
    return getDb().prepare('SELECT * FROM catalogue WHERE id = ?').get(id) as CatalogueItem;
  });

  ipc.handle('catalogue:toggle', (_evt, id: number) => {
    getDb().prepare('UPDATE catalogue SET actif = CASE actif WHEN 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
    return getDb().prepare('SELECT * FROM catalogue WHERE id = ?').get(id) as CatalogueItem;
  });

  ipc.handle('catalogue:delete', (_evt, id: number) => {
    getDb().prepare('DELETE FROM catalogue WHERE id = ?').run(id);
    return { ok: true };
  });
}
