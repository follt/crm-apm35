export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('particulier', 'professionnel', 'syndic')) NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT,
  raison_sociale TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  siret TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalogue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categorie TEXT CHECK(categorie IN ('placo', 'isolation', 'menuiserie', 'main_oeuvre', 'autre')) NOT NULL,
  designation TEXT NOT NULL,
  description TEXT,
  unite TEXT CHECK(unite IN ('m²', 'm', 'unité', 'forfait', 'heure')) NOT NULL,
  prix_ht REAL NOT NULL,
  taux_tva REAL NOT NULL DEFAULT 20.00,
  actif INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  client_id INTEGER NOT NULL,
  date_emission DATE NOT NULL,
  date_validite DATE NOT NULL,
  statut TEXT CHECK(statut IN ('brouillon', 'envoyé', 'accepté', 'refusé', 'expiré')) DEFAULT 'brouillon',
  objet TEXT NOT NULL,
  conditions_paiement TEXT DEFAULT 'À réception de facture',
  delai_realisation TEXT,
  total_ht REAL NOT NULL,
  total_tva REAL NOT NULL,
  total_ttc REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS devis_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devis_id INTEGER NOT NULL,
  ordre INTEGER NOT NULL,
  designation TEXT NOT NULL,
  description TEXT,
  quantite REAL NOT NULL,
  unite TEXT NOT NULL,
  prix_unitaire_ht REAL NOT NULL,
  taux_tva REAL NOT NULL,
  montant_ht REAL NOT NULL,
  montant_tva REAL NOT NULL,
  montant_ttc REAL NOT NULL,
  FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS factures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  devis_id INTEGER,
  client_id INTEGER NOT NULL,
  date_emission DATE NOT NULL,
  date_echeance DATE NOT NULL,
  statut TEXT CHECK(statut IN ('brouillon', 'envoyée', 'payée', 'partiellement_payée', 'en_retard', 'annulée')) DEFAULT 'brouillon',
  objet TEXT NOT NULL,
  conditions_paiement TEXT DEFAULT 'À réception de facture',
  total_ht REAL NOT NULL,
  total_tva REAL NOT NULL,
  total_ttc REAL NOT NULL,
  montant_paye REAL DEFAULT 0,
  date_paiement DATE,
  mode_paiement TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (devis_id) REFERENCES devis(id)
);

CREATE TABLE IF NOT EXISTS factures_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER NOT NULL,
  ordre INTEGER NOT NULL,
  designation TEXT NOT NULL,
  description TEXT,
  quantite REAL NOT NULL,
  unite TEXT NOT NULL,
  prix_unitaire_ht REAL NOT NULL,
  taux_tva REAL NOT NULL,
  montant_ht REAL NOT NULL,
  montant_tva REAL NOT NULL,
  montant_ttc REAL NOT NULL,
  FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facture_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('automatique', 'manuelle')) DEFAULT 'automatique',
  date_envoi DATETIME NOT NULL,
  niveau INTEGER DEFAULT 1,
  email_destinataire TEXT,
  statut TEXT CHECK(statut IN ('envoyée', 'échouée')) DEFAULT 'envoyée',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facture_id) REFERENCES factures(id)
);

CREATE TABLE IF NOT EXISTS configuration (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  raison_sociale TEXT NOT NULL,
  forme_juridique TEXT DEFAULT 'SARL',
  siret TEXT,
  tva_intracommunautaire TEXT,
  rcs TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email TEXT,
  logo_path TEXT,
  icon_path TEXT,
  iban TEXT,
  bic TEXT,
  conditions_generales TEXT,
  mentions_legales TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_secure INTEGER DEFAULT 0,
  smtp_user TEXT,
  smtp_password TEXT,
  email_from TEXT,
  signature_html TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS relances_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  auto_enabled INTEGER DEFAULT 0,
  delai_relance_1 INTEGER DEFAULT 7,
  delai_relance_2 INTEGER DEFAULT 21,
  delai_relance_3 INTEGER DEFAULT 45,
  template_niveau_1 TEXT,
  template_niveau_2 TEXT,
  template_niveau_3 TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);
CREATE INDEX IF NOT EXISTS idx_devis_numero ON devis(numero);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);
CREATE INDEX IF NOT EXISTS idx_devis_client ON devis(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_numero ON factures(numero);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_echeance ON factures(date_echeance);
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id);
`;

export type ClientType = 'particulier' | 'professionnel' | 'syndic';
export type CatalogueCategorie = 'placo' | 'isolation' | 'menuiserie' | 'main_oeuvre' | 'autre';
export type Unite = 'm²' | 'm' | 'unité' | 'forfait' | 'heure';
export type DevisStatut = 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré';
export type FactureStatut = 'brouillon' | 'envoyée' | 'payée' | 'partiellement_payée' | 'en_retard' | 'annulée';

export interface Client {
  id: number;
  type: ClientType;
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
  created_at: string;
  updated_at: string;
}

export interface CatalogueItem {
  id: number;
  categorie: CatalogueCategorie;
  designation: string;
  description: string | null;
  unite: Unite;
  prix_ht: number;
  taux_tva: number;
  actif: number;
  created_at: string;
}

export interface Devis {
  id: number;
  numero: string;
  client_id: number;
  date_emission: string;
  date_validite: string;
  statut: DevisStatut;
  objet: string;
  conditions_paiement: string;
  delai_realisation: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Facture {
  id: number;
  numero: string;
  devis_id: number | null;
  client_id: number;
  date_emission: string;
  date_echeance: string;
  statut: FactureStatut;
  objet: string;
  conditions_paiement: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  montant_paye: number;
  date_paiement: string | null;
  mode_paiement: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
