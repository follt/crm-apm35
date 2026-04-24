import type { ClientType, CatalogueCategorie } from '../db/schema.js';

export function calculerTauxTVA(
  clientType: ClientType,
  categorieProduit: CatalogueCategorie,
): number {
  if (clientType === 'professionnel' || clientType === 'syndic') return 20.0;
  if (categorieProduit === 'isolation' || categorieProduit === 'menuiserie') return 5.5;
  if (categorieProduit === 'placo' || categorieProduit === 'main_oeuvre') return 10.0;
  return 20.0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineInput {
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
}

export interface ComputedLine extends LineInput {
  raw_ht: number;
  raw_tva: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
}

export function computeLine(l: LineInput): ComputedLine {
  const qte = Number.isFinite(l.quantite) ? l.quantite : 0;
  const pu = Number.isFinite(l.prix_unitaire_ht) ? l.prix_unitaire_ht : 0;
  const taux = Number.isFinite(l.taux_tva) ? l.taux_tva : 0;
  const raw_ht = qte * pu;
  const raw_tva = raw_ht * (taux / 100);
  return {
    quantite: qte,
    prix_unitaire_ht: pu,
    taux_tva: taux,
    raw_ht,
    raw_tva,
    montant_ht: round2(raw_ht),
    montant_tva: round2(raw_tva),
    montant_ttc: round2(raw_ht + raw_tva),
  };
}

export function computeTotaux(lines: ComputedLine[]) {
  let total_ht_raw = 0;
  const tva_raw_by: Record<string, number> = {};
  for (const l of lines) {
    total_ht_raw += l.raw_ht;
    const key = String(l.taux_tva);
    tva_raw_by[key] = (tva_raw_by[key] ?? 0) + l.raw_tva;
  }
  const total_tva_raw = Object.values(tva_raw_by).reduce((a, b) => a + b, 0);
  return {
    total_ht: round2(total_ht_raw),
    total_tva: round2(total_tva_raw),
    total_ttc: round2(total_ht_raw + total_tva_raw),
    totaux_tva_detailles: Object.fromEntries(
      Object.entries(tva_raw_by).map(([k, v]) => [k, round2(v)]),
    ),
  };
}

// Backwards-compatible aliases
export const calculerLigne = computeLine;
export const calculerTotaux = computeTotaux;
