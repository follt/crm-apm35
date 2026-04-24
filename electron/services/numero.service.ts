import { getDb } from '../db/database.js';

function nextNumero(prefix: string, table: 'devis' | 'factures', annee: number): string {
  const prefixedLike = `${prefix}-${annee}-%`;
  const row = getDb()
    .prepare(`SELECT numero FROM ${table} WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(prefixedLike) as { numero: string } | undefined;

  let next = 1;
  if (row) {
    const parts = row.numero.split('-');
    next = parseInt(parts[2] ?? '0', 10) + 1;
  }
  return `${prefix}-${annee}-${String(next).padStart(3, '0')}`;
}

export function nextDevisNumero(annee = new Date().getFullYear()): string {
  return nextNumero('DEV', 'devis', annee);
}

export function nextFactureNumero(annee = new Date().getFullYear()): string {
  return nextNumero('FACT', 'factures', annee);
}
