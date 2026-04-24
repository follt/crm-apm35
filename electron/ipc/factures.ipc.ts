import type { IpcMain } from 'electron';
import { getDb } from '../db/database.js';
import type { Facture, FactureStatut } from '../db/schema.js';
import { nextFactureNumero } from '../services/numero.service.js';
import { computeLine, computeTotaux } from '../services/tva.service.js';
import { generateFacturePdf } from '../services/pdf.service.js';
import { sendFactureByEmail, sendRelanceByEmail, buildDefaultFactureEmail, type SendOverride } from '../services/email.service.js';

export interface FactureLigneInput {
  designation: string;
  description?: string | null;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: number;
}

export interface FacturePayload {
  client_id: number;
  date_emission: string;
  date_echeance: string;
  objet: string;
  conditions_paiement: string;
  mode_paiement?: string | null;
  notes?: string | null;
  lignes: FactureLigneInput[];
}

function recomputeLignes(lignes: FactureLigneInput[]) {
  const enriched = lignes.map((l, i) => {
    const c = computeLine(l);
    return { ...l, ordre: i + 1, ...c };
  });
  const totaux = computeTotaux(enriched);
  return { enriched, totaux };
}

function getFactureDetail(id: number) {
  const db = getDb();
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(id) as Facture | undefined;
  if (!facture) throw new Error(`Facture ${id} introuvable`);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(facture.client_id);
  const lignes = db.prepare('SELECT * FROM factures_lignes WHERE facture_id = ? ORDER BY ordre').all(id);
  const relances = db.prepare('SELECT * FROM relances WHERE facture_id = ? ORDER BY date_envoi DESC').all(id);
  return { facture, client, lignes, relances };
}

function recomputeStatutFromPayment(factureId: number): FactureStatut {
  const db = getDb();
  const f = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId) as Facture | undefined;
  if (!f) throw new Error('Facture introuvable');
  if (f.montant_paye >= f.total_ttc) return 'payée';
  if (f.montant_paye > 0) return 'partiellement_payée';
  const today = new Date().toISOString().split('T')[0];
  if (f.date_echeance < today && f.statut !== 'brouillon') return 'en_retard';
  return f.statut === 'brouillon' ? 'brouillon' : 'envoyée';
}

export function registerFacturesIpc(ipc: IpcMain): void {
  ipc.handle('factures:get', (_evt, id: number) => getFactureDetail(id));

  ipc.handle('factures:create', (_evt, payload: FacturePayload) => {
    if (!payload.lignes || payload.lignes.length === 0) throw new Error('Au moins une ligne requise');
    const { enriched, totaux } = recomputeLignes(payload.lignes);
    const db = getDb();

    const insert = db.transaction(() => {
      const numero = nextFactureNumero();
      const result = db.prepare(`
        INSERT INTO factures (numero, client_id, date_emission, date_echeance, statut, objet,
          conditions_paiement, total_ht, total_tva, total_ttc, mode_paiement, notes)
        VALUES (?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numero, payload.client_id, payload.date_emission, payload.date_echeance,
        payload.objet, payload.conditions_paiement, totaux.total_ht, totaux.total_tva, totaux.total_ttc,
        payload.mode_paiement ?? null, payload.notes ?? null,
      );
      const factureId = Number(result.lastInsertRowid);
      const stmt = db.prepare(`
        INSERT INTO factures_lignes (facture_id, ordre, designation, description, quantite, unite,
          prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of enriched) {
        stmt.run(factureId, l.ordre, l.designation, l.description ?? null, l.quantite, l.unite,
          l.prix_unitaire_ht, l.taux_tva, l.montant_ht, l.montant_tva, l.montant_ttc);
      }
      return factureId;
    });

    return getFactureDetail(insert());
  });

  ipc.handle('factures:update', (_evt, id: number, payload: FacturePayload) => {
    const { enriched, totaux } = recomputeLignes(payload.lignes);
    const db = getDb();

    const update = db.transaction(() => {
      db.prepare(`
        UPDATE factures SET
          client_id = ?, date_emission = ?, date_echeance = ?, objet = ?,
          conditions_paiement = ?, mode_paiement = ?, notes = ?,
          total_ht = ?, total_tva = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        payload.client_id, payload.date_emission, payload.date_echeance, payload.objet,
        payload.conditions_paiement, payload.mode_paiement ?? null, payload.notes ?? null,
        totaux.total_ht, totaux.total_tva, totaux.total_ttc, id,
      );
      db.prepare('DELETE FROM factures_lignes WHERE facture_id = ?').run(id);
      const stmt = db.prepare(`
        INSERT INTO factures_lignes (facture_id, ordre, designation, description, quantite, unite,
          prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of enriched) {
        stmt.run(id, l.ordre, l.designation, l.description ?? null, l.quantite, l.unite,
          l.prix_unitaire_ht, l.taux_tva, l.montant_ht, l.montant_tva, l.montant_ttc);
      }
    });

    update();
    return getFactureDetail(id);
  });

  ipc.handle('factures:delete', (_evt, id: number) => {
    const row = getDb().prepare('SELECT statut FROM factures WHERE id = ?').get(id) as { statut: FactureStatut } | undefined;
    if (!row) throw new Error('Facture introuvable');
    if (row.statut !== 'brouillon') throw new Error('Seuls les brouillons peuvent être supprimés');
    getDb().prepare('DELETE FROM factures WHERE id = ?').run(id);
    return { ok: true };
  });

  ipc.handle('factures:mark-paid', (_evt, id: number, mode_paiement: string, date_paiement: string) => {
    const db = getDb();
    const f = db.prepare('SELECT total_ttc FROM factures WHERE id = ?').get(id) as { total_ttc: number } | undefined;
    if (!f) throw new Error('Facture introuvable');

    db.prepare(`
      UPDATE factures SET montant_paye = ?, mode_paiement = ?, date_paiement = ?, statut = 'payée',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(f.total_ttc, mode_paiement, date_paiement, id);

    return getFactureDetail(id);
  });

  ipc.handle('factures:partial-pay', (_evt, id: number, amount: number, mode_paiement: string, date_paiement: string) => {
    const db = getDb();
    const f = db.prepare('SELECT * FROM factures WHERE id = ?').get(id) as Facture | undefined;
    if (!f) throw new Error('Facture introuvable');
    const newPaid = Math.min(f.total_ttc, f.montant_paye + amount);

    db.prepare(`
      UPDATE factures SET montant_paye = ?, mode_paiement = ?, date_paiement = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newPaid, mode_paiement, date_paiement, id);

    const statut = recomputeStatutFromPayment(id);
    db.prepare('UPDATE factures SET statut = ? WHERE id = ?').run(statut, id);

    return getFactureDetail(id);
  });

  ipc.handle('factures:set-statut', (_evt, id: number, statut: FactureStatut) => {
    getDb().prepare('UPDATE factures SET statut = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(statut, id);
    return getFactureDetail(id);
  });

  ipc.handle('factures:pdf', async (_evt, id: number) => {
    const path = await generateFacturePdf(id);
    return { path };
  });

  ipc.handle('factures:email-defaults', (_evt, id: number) => {
    return buildDefaultFactureEmail(id);
  });

  ipc.handle('factures:send-email', async (_evt, id: number, override?: SendOverride) => {
    const result = await sendFactureByEmail(id, override);
    getDb().prepare("UPDATE factures SET statut = 'envoyée', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND statut = 'brouillon'").run(id);
    return result;
  });

  ipc.handle('factures:send-relance', async (_evt, id: number) => {
    return sendRelanceByEmail(id, 'manuelle');
  });
}
