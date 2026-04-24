import type Database from 'better-sqlite3';
import { DEFAULT_RELANCE_N1, DEFAULT_RELANCE_N2, DEFAULT_RELANCE_N3 } from './relance-templates.js';

export function seedDatabase(db: Database.Database): void {
  const insertConfig = db.prepare(`
    INSERT OR REPLACE INTO configuration (
      id, raison_sociale, forme_juridique, siret, tva_intracommunautaire, rcs,
      adresse, code_postal, ville, telephone, email,
      conditions_generales, mentions_legales
    ) VALUES (1, ?, 'SARL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertConfig.run(
    'ARTISAN BTP SARL',
    '12345678901234',
    'FR12345678901',
    'RCS Rennes B 123 456 789',
    '15 Rue du Bâtiment',
    '35000',
    'Rennes',
    '02 99 00 00 00',
    'sarlapm35@gmail.com',
    'Paiement à réception de facture. Pénalités de retard : 3 fois le taux légal.',
    'SARL au capital de 10 000€ - SIRET 12345678901234 - TVA FR12345678901',
  );

  db.prepare(`
    INSERT OR REPLACE INTO email_config (
      id, smtp_host, smtp_port, smtp_secure, smtp_user, email_from, signature_html
    ) VALUES (1, 'smtp.gmail.com', 587, 0, 'sarlapm35@gmail.com', 'sarlapm35@gmail.com', ?)
  `).run('<p>Cordialement,<br/><strong>ARTISAN BTP SARL</strong></p>');

  db.prepare(`
    INSERT OR REPLACE INTO relances_config (
      id, auto_enabled, delai_relance_1, delai_relance_2, delai_relance_3,
      template_niveau_1, template_niveau_2, template_niveau_3
    ) VALUES (1, 0, 7, 21, 45, ?, ?, ?)
  `).run(
    DEFAULT_RELANCE_N1,
    DEFAULT_RELANCE_N2,
    DEFAULT_RELANCE_N3,
  );

  const insertClient = db.prepare(`
    INSERT INTO clients (type, nom, prenom, raison_sociale, siret, email, telephone, adresse, code_postal, ville)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const clients = [
    ['particulier', 'Dupont', 'Jean', null, null, 'jean.dupont@email.fr', '06 12 34 56 78', '12 Rue de la Paix', '35000', 'Rennes'],
    ['particulier', 'Martin', 'Sophie', null, null, 'sophie.martin@email.fr', '06 98 76 54 32', '8 Avenue du Général', '35700', 'Rennes'],
    ['professionnel', 'HOLDING IMMO SAS', null, 'HOLDING IMMO SAS', '98765432109876', 'contact@holdingimmo.fr', '02 99 11 22 33', '50 Boulevard du Commerce', '35000', 'Rennes'],
    ['professionnel', 'BUREAU ARCHI DESIGN', null, 'BUREAU ARCHI DESIGN', '11122233344455', 'info@archidesign.fr', '02 99 44 55 66', "3 Place de l'Hôtel de Ville", '35000', 'Rennes'],
    ['syndic', 'SYNDIC COPROPRIÉTÉ OUEST', null, 'SYNDIC COPROPRIÉTÉ OUEST', '55566677788899', 'syndic@copro-ouest.fr', '02 99 77 88 99', '120 Rue de la République', '35200', 'Rennes'],
  ] as const;

  for (const c of clients) insertClient.run(...c);

  const insertProduit = db.prepare(`
    INSERT INTO catalogue (categorie, designation, description, unite, prix_ht, taux_tva, actif)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  const produits = [
    ['placo', 'Plaque BA13 standard', 'Plaque de plâtre standard 13mm', 'm²', 8.5, 10.0],
    ['placo', 'Plaque BA13 hydrofuge', 'Plaque de plâtre hydrofuge 13mm', 'm²', 12.0, 10.0],
    ['placo', 'Rail 48mm', 'Rail métallique pour ossature', 'm', 2.5, 20.0],
    ['isolation', 'Laine de verre 100mm', 'Isolation thermique 100mm', 'm²', 12.0, 5.5],
    ['isolation', 'Laine de verre 200mm', 'Isolation thermique 200mm', 'm²', 18.0, 5.5],
    ['isolation', 'Polystyrène extrudé', 'Isolation extérieure 120mm', 'm²', 25.0, 5.5],
    ['menuiserie', 'Fenêtre PVC double vitrage 1x1m', 'Fenêtre 1 vantail PVC blanc', 'unité', 350.0, 5.5],
    ['menuiserie', "Porte d'entrée PVC", 'Porte blindée PVC', 'unité', 850.0, 5.5],
    ['menuiserie', 'Fenêtre bois 2x1.5m', 'Fenêtre 2 vantaux bois', 'unité', 650.0, 5.5],
    ['main_oeuvre', 'Pose placo', "Main d'œuvre pose plaques", 'heure', 45.0, 10.0],
    ['main_oeuvre', 'Pose isolation', "Main d'œuvre isolation", 'heure', 40.0, 10.0],
    ['main_oeuvre', 'Pose menuiserie', "Main d'œuvre installation fenêtres/portes", 'heure', 50.0, 10.0],
  ] as const;

  for (const p of produits) insertProduit.run(...p);

  const devis1 = db.prepare(`
    INSERT INTO devis (numero, client_id, date_emission, date_validite, statut, objet, conditions_paiement, delai_realisation, total_ht, total_tva, total_ttc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('DEV-2024-001', 1, '2024-03-01', '2024-03-31', 'envoyé', 'Isolation combles perdus', 'À réception de facture', '2 semaines', 2100.0, 129.0, 2229.0);

  db.prepare(`
    INSERT INTO devis_lignes (devis_id, ordre, designation, description, quantite, unite, prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
    VALUES (?, 1, 'Laine de verre 200mm', 'Isolation thermique 200mm', 100, 'm²', 18.00, 5.50, 1800.00, 99.00, 1899.00),
           (?, 2, 'Pose isolation', ?, 7.5, 'heure', 40.00, 10.00, 300.00, 30.00, 330.00)
  `).run(devis1.lastInsertRowid, devis1.lastInsertRowid, "Main d'œuvre isolation");

  const devis2 = db.prepare(`
    INSERT INTO devis (numero, client_id, date_emission, date_validite, statut, objet, conditions_paiement, total_ht, total_tva, total_ttc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('DEV-2024-002', 2, '2024-03-10', '2024-04-09', 'accepté', 'Remplacement 3 fenêtres', 'Acompte 30% à la commande, solde à réception', 2800.0, 174.25, 2974.25);

  db.prepare(`
    INSERT INTO devis_lignes (devis_id, ordre, designation, description, quantite, unite, prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
    VALUES (?, 1, 'Fenêtre PVC double vitrage 1x1m', 'Fenêtre 1 vantail PVC blanc', 3, 'unité', 350.00, 5.50, 1050.00, 57.75, 1107.75),
           (?, 2, 'Fenêtre bois 2x1.5m', 'Fenêtre 2 vantaux bois', 2, 'unité', 650.00, 5.50, 1300.00, 71.50, 1371.50),
           (?, 3, 'Pose menuiserie', ?, 9, 'heure', 50.00, 10.00, 450.00, 45.00, 495.00)
  `).run(devis2.lastInsertRowid, devis2.lastInsertRowid, devis2.lastInsertRowid, "Main d'œuvre installation");

  const facture1 = db.prepare(`
    INSERT INTO factures (numero, client_id, date_emission, date_echeance, statut, objet, conditions_paiement, total_ht, total_tva, total_ttc, montant_paye, date_paiement, mode_paiement)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('FACT-2024-001', 1, '2024-02-15', '2024-03-17', 'payée', 'Réparation plafond cuisine', 'À réception de facture', 445.0, 89.0, 534.0, 534.0, '2024-02-20', 'Virement');

  db.prepare(`
    INSERT INTO factures_lignes (facture_id, ordre, designation, description, quantite, unite, prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
    VALUES (?, 1, 'Plaque BA13 standard', 'Remplacement plafond', 10, 'm²', 8.50, 20.00, 85.00, 17.00, 102.00),
           (?, 2, 'Pose placo', ?, 8, 'heure', 45.00, 20.00, 360.00, 72.00, 432.00)
  `).run(facture1.lastInsertRowid, facture1.lastInsertRowid, "Main d'œuvre réparation");

  const facture2 = db.prepare(`
    INSERT INTO factures (numero, client_id, date_emission, date_echeance, statut, objet, conditions_paiement, total_ht, total_tva, total_ttc, montant_paye)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('FACT-2024-002', 4, '2024-02-01', '2024-03-03', 'en_retard', 'Aménagement salle de réunion', 'À réception de facture - 30 jours', 1895.0, 379.0, 2274.0, 0);

  db.prepare(`
    INSERT INTO factures_lignes (facture_id, ordre, designation, description, quantite, unite, prix_unitaire_ht, taux_tva, montant_ht, montant_tva, montant_ttc)
    VALUES (?, 1, 'Plaque BA13 hydrofuge', 'Cloisonnement hydrofuge', 35, 'm²', 12.00, 20.00, 420.00, 84.00, 504.00),
           (?, 2, 'Rail 48mm', 'Ossature métallique', 50, 'm', 2.50, 20.00, 125.00, 25.00, 150.00),
           (?, 3, 'Pose placo', ?, 30, 'heure', 45.00, 20.00, 1350.00, 270.00, 1620.00)
  `).run(facture2.lastInsertRowid, facture2.lastInsertRowid, facture2.lastInsertRowid, "Main d'œuvre pose");

  db.prepare(`
    INSERT INTO relances (facture_id, type, date_envoi, niveau, email_destinataire, statut)
    VALUES (?, 'automatique', ?, 1, ?, 'envoyée')
  `).run(facture2.lastInsertRowid, '2024-03-10', 'info@archidesign.fr');

  console.log('Database seeded with demo data.');
}
