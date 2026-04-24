import type { IpcMain } from 'electron';
import { getDb } from '../db/database.js';
import type { Devis, Facture } from '../db/schema.js';
import { registerConfigIpc } from './config.ipc.js';
import { registerClientsIpc } from './clients.ipc.js';
import { registerCatalogueIpc } from './catalogue.ipc.js';
import { registerDevisIpc } from './devis.ipc.js';
import { registerFacturesIpc } from './factures.ipc.js';

export function registerIpcHandlers(ipc: IpcMain): void {
  registerConfigIpc(ipc);
  registerClientsIpc(ipc);
  registerCatalogueIpc(ipc);
  registerDevisIpc(ipc);
  registerFacturesIpc(ipc);

  ipc.handle('devis:list', (): Array<Devis & { client_nom: string }> => {
    return getDb().prepare(`
      SELECT d.*, COALESCE(c.raison_sociale, c.nom || ' ' || COALESCE(c.prenom, '')) AS client_nom
      FROM devis d
      JOIN clients c ON c.id = d.client_id
      ORDER BY d.date_emission DESC
    `).all() as Array<Devis & { client_nom: string }>;
  });

  ipc.handle('factures:list', (): Array<Facture & { client_nom: string }> => {
    return getDb().prepare(`
      SELECT f.*, COALESCE(c.raison_sociale, c.nom || ' ' || COALESCE(c.prenom, '')) AS client_nom
      FROM factures f
      JOIN clients c ON c.id = f.client_id
      ORDER BY f.date_emission DESC
    `).all() as Array<Facture & { client_nom: string }>;
  });

  ipc.handle('dashboard:stats', () => {
    const db = getDb();
    const caStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', date_emission) = strftime('%Y-%m', 'now') THEN total_ttc END), 0) AS ca_mois,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', date_emission) = strftime('%Y-%m', 'now', '-1 month') THEN total_ttc END), 0) AS ca_mois_prec,
        COALESCE(SUM(CASE WHEN statut IN ('envoyée', 'en_retard', 'partiellement_payée') THEN total_ttc - montant_paye END), 0) AS impayes_montant,
        COUNT(CASE WHEN statut IN ('envoyée', 'en_retard', 'partiellement_payée') THEN 1 END) AS impayes_count
      FROM factures
    `).get() as { ca_mois: number; ca_mois_prec: number; impayes_montant: number; impayes_count: number };

    const devisStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN statut = 'envoyé' THEN 1 END) AS en_attente,
        COUNT(*) AS total,
        COUNT(CASE WHEN statut = 'accepté' THEN 1 END) AS acceptes,
        COUNT(CASE WHEN statut = 'brouillon' THEN 1 END) AS brouillons,
        COUNT(CASE WHEN statut = 'refusé' THEN 1 END) AS refuses,
        COUNT(CASE WHEN statut = 'expiré' THEN 1 END) AS expires
      FROM devis
    `).get() as { en_attente: number; total: number; acceptes: number; brouillons: number; refuses: number; expires: number };

    const monthlyCa = db.prepare(`
      SELECT
        strftime('%Y-%m', date_emission) AS month,
        COALESCE(SUM(total_ttc), 0) AS ca
      FROM factures
      WHERE date_emission >= date('now', '-11 months', 'start of month')
        AND statut != 'annulée'
      GROUP BY strftime('%Y-%m', date_emission)
      ORDER BY month
    `).all() as Array<{ month: string; ca: number }>;

    const recentDevis = db.prepare(`
      SELECT d.id, d.numero, d.statut, d.date_emission, d.total_ttc, d.objet,
             COALESCE(c.raison_sociale, c.nom || ' ' || COALESCE(c.prenom, '')) AS client_nom
      FROM devis d
      JOIN clients c ON c.id = d.client_id
      ORDER BY d.id DESC
      LIMIT 5
    `).all();

    const overdueFactures = db.prepare(`
      SELECT f.id, f.numero, f.date_echeance, f.total_ttc, f.montant_paye,
             COALESCE(c.raison_sociale, c.nom || ' ' || COALESCE(c.prenom, '')) AS client_nom,
             CAST(julianday('now') - julianday(f.date_echeance) AS INTEGER) AS jours_retard
      FROM factures f
      JOIN clients c ON c.id = f.client_id
      WHERE (f.statut IN ('envoyée', 'en_retard', 'partiellement_payée'))
        AND f.date_echeance < date('now')
      ORDER BY f.date_echeance
      LIMIT 5
    `).all();

    const variation = caStats.ca_mois_prec > 0
      ? ((caStats.ca_mois - caStats.ca_mois_prec) / caStats.ca_mois_prec) * 100
      : null;

    return {
      ca_mois: caStats.ca_mois,
      ca_mois_variation: variation,
      impayes_count: caStats.impayes_count,
      impayes_montant: caStats.impayes_montant,
      devis_en_attente: devisStats.en_attente,
      taux_conversion: devisStats.total > 0 ? (devisStats.acceptes / devisStats.total) * 100 : 0,
      devis_status: {
        brouillon: devisStats.brouillons,
        envoyé: devisStats.en_attente,
        accepté: devisStats.acceptes,
        refusé: devisStats.refuses,
        expiré: devisStats.expires,
      },
      monthly_ca: monthlyCa,
      recent_devis: recentDevis,
      overdue_factures: overdueFactures,
    };
  });
}
