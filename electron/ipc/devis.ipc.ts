import type { IpcMain } from 'electron';
import { getDb } from '../db/database.js';
import type { Devis, DevisStatut } from '../db/schema.js';
import { nextDevisNumero, nextFactureNumero } from '../services/numero.service.js';
import { computeLine, computeTotaux } from '../services/tva.service.js';
import { generateDevisPdf } from '../services/pdf.service.js';
import { sendDevisByEmail, buildDefaultDevisEmail, type SendOverride } from '../services/email.service.js';

export interface DevisLigneInput {
  designation: string;
  description?: string | null;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: number;
}

export interface DevisPayload {
  client_id: number;
  date_emission: string;
  date_validite: string;
  objet: string;
  conditions_paiement: string;
  delai_realisation: string | null;
  notes: string | null;
  lignes: DevisLigneInput[];
}

function recomputeLignes(lignes: DevisLigneInput[]) {
  const enriched = lignes.map((l, i) => {
    const c = computeLine(l);
    return { ...l, ordre: i + 1, ...c };
  });
  const totaux = computeTotaux(enriched);
  return { enriched, totaux };
}

function getDevisDetail(id: number) {
  const db = getDb();
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id) as Devis | undefined;
  if (!devis) throw new Error(`Devis ${id} introuvable`);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(devis.client_id);
  const lignes = db.prepare('SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY ordre').all(id);
  return { devis, client, lignes };
}

export function registerDevisIpc(ipc: IpcMain): void {
  ipc.handle('devis:get', (_evt, id: number) => getDevisDetail(id));

  ipc.handle('devis:create', (_evt, payload: DevisPayload) => {
    if (!payload.lignes || payload.lignes.length === 0) throw new Error('Au moins une ligne requise');
    const { enriched, totaux } = recomputeLignes(payload.lignes);
    const db = getDb();

    const insert = db.transaction(() => {
      const numero = nextDevisNumero();
      const result = db.prepare(`
        INSERT INTO devis (numero, client_id, date_emission, date_validite, statut, objet,
          conditions_paiement, delai_realisation, total_ht, total_tva, total_ttc, notes)
        VALUES (?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numero, payload.client_id, payload.date_emission, payload.date_validite,
        payload.objet, payload.conditions_paiement, payload.delai_realisation,
        totaux.total_ht, totaux.total_tva, totaux.total_ttc, payload.notes,
      );

      const devisId = Number(result.lastInsertRowid);
      const stmt = db.prepare(`
        INSERT INTO devis_lignes (devis_id, ordre, designation, description, quantite, unite,
          prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of enriched) {
        stmt.run(devisId, l.ordre, l.designation, l.description ?? null, l.quantite, l.unite,
          l.prix_unitaire_ht, l.taux_tva, l.montant_ht, l.montant_tva, l.montant_ttc);
      }
      return devisId;
    });

    const id = insert();
    return getDevisDetail(id);
  });

  ipc.handle('devis:update', (_evt, id: number, payload: DevisPayload) => {
    const { enriched, totaux } = recomputeLignes(payload.lignes);
    const db = getDb();

    const update = db.transaction(() => {
      db.prepare(`
        UPDATE devis SET
          client_id = ?, date_emission = ?, date_validite = ?, objet = ?,
          conditions_paiement = ?, delai_realisation = ?, notes = ?,
          total_ht = ?, total_tva = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        payload.client_id, payload.date_emission, payload.date_validite, payload.objet,
        payload.conditions_paiement, payload.delai_realisation, payload.notes,
        totaux.total_ht, totaux.total_tva, totaux.total_ttc, id,
      );

      db.prepare('DELETE FROM devis_lignes WHERE devis_id = ?').run(id);
      const stmt = db.prepare(`
        INSERT INTO devis_lignes (devis_id, ordre, designation, description, quantite, unite,
          prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of enriched) {
        stmt.run(id, l.ordre, l.designation, l.description ?? null, l.quantite, l.unite,
          l.prix_unitaire_ht, l.taux_tva, l.montant_ht, l.montant_tva, l.montant_ttc);
      }
    });

    update();
    return getDevisDetail(id);
  });

  ipc.handle('devis:delete', (_evt, id: number) => {
    const row = getDb().prepare('SELECT statut FROM devis WHERE id = ?').get(id) as { statut: DevisStatut } | undefined;
    if (!row) throw new Error('Devis introuvable');
    if (row.statut !== 'brouillon') throw new Error('Seuls les brouillons peuvent être supprimés');
    getDb().prepare('DELETE FROM devis WHERE id = ?').run(id);
    return { ok: true };
  });

  ipc.handle('devis:set-statut', (_evt, id: number, statut: DevisStatut) => {
    getDb().prepare('UPDATE devis SET statut = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(statut, id);
    return getDevisDetail(id);
  });

  ipc.handle('devis:pdf', async (_evt, id: number) => {
    const path = await generateDevisPdf(id);
    return { path };
  });

  ipc.handle('devis:email-defaults', (_evt, id: number) => {
    return buildDefaultDevisEmail(id);
  });

  ipc.handle('devis:send-email', async (_evt, id: number, override?: SendOverride) => {
    const result = await sendDevisByEmail(id, override);
    getDb().prepare("UPDATE devis SET statut = 'envoyé', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND statut = 'brouillon'").run(id);
    return result;
  });

  ipc.handle('devis:to-facture', (_evt, devisId: number) => {
    const db = getDb();
    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(devisId) as Devis | undefined;
    if (!devis) throw new Error('Devis introuvable');
    if (devis.statut !== 'accepté') throw new Error('Seuls les devis acceptés peuvent être transformés en facture');

    const already = db.prepare('SELECT id FROM factures WHERE devis_id = ?').get(devisId);
    if (already) throw new Error('Ce devis a déjà été transformé en facture');

    const today = new Date().toISOString().split('T')[0];
    const echeance = new Date();
    echeance.setDate(echeance.getDate() + 30);
    const dateEcheance = echeance.toISOString().split('T')[0];

    const create = db.transaction(() => {
      const numero = nextFactureNumero();
      const result = db.prepare(`
        INSERT INTO factures (numero, devis_id, client_id, date_emission, date_echeance,
          statut, objet, conditions_paiement, total_ht, total_tva, total_ttc, notes)
        VALUES (?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?)
      `).run(
        numero, devisId, devis.client_id, today, dateEcheance,
        devis.objet, devis.conditions_paiement, devis.total_ht, devis.total_tva, devis.total_ttc, devis.notes,
      );
      const factureId = Number(result.lastInsertRowid);

      const lignes = db.prepare('SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY ordre').all(devisId) as Array<{
        ordre: number;
        designation: string;
        description: string | null;
        quantite: number;
        unite: string;
        prix_unitaire_ht: number;
        taux_tva: number;
        montant_ht: number;
        montant_tva: number;
        montant_ttc: number;
      }>;
      const stmt = db.prepare(`
        INSERT INTO factures_lignes (facture_id, ordre, designation, description, quantite, unite,
          prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of lignes) {
        stmt.run(factureId, l.ordre, l.designation, l.description, l.quantite, l.unite,
          l.prix_unitaire_ht, l.taux_tva, l.montant_ht, l.montant_tva, l.montant_ttc);
      }
      return { factureId, numero };
    });

    return create();
  });
}
