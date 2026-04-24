import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getDb } from '../db/database.js';
import type { Devis, Facture, Client } from '../db/schema.js';

interface Config {
  raison_sociale: string;
  siret: string | null;
  tva_intracommunautaire: string | null;
  rcs: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  logo_path: string | null;
  iban: string | null;
  bic: string | null;
  conditions_generales: string | null;
  mentions_legales: string | null;
}

interface Ligne {
  designation: string;
  description: string | null;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
}

const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#EFF6FF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  white: '#FFFFFF',
  success: '#059669',
};

const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const RIGHT_EDGE = PAGE.width - PAGE.margin;

const fmtEuroRaw = (n: number) => {
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `${formatted} €`;
};
const fmtDate = (s: string) => new Intl.DateTimeFormat('fr-FR').format(new Date(s));
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

function pdfOutputDir(): string {
  const dir = path.join(app.getPath('userData'), 'pdfs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getConfig(): Config {
  const cfg = getDb().prepare('SELECT * FROM configuration WHERE id = 1').get() as Config | undefined;
  if (!cfg) throw new Error('Configuration entreprise introuvable');
  return cfg;
}

function drawLine(doc: PDFKit.PDFDocument, x1: number, y: number, x2: number, color: string = COLORS.border, weight: number = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(weight).stroke();
}

function singleLineText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, opts: { align?: 'left' | 'right' | 'center' } = {}) {
  doc.text(text, x, y, { width, align: opts.align ?? 'left', lineBreak: false, ellipsis: true });
}

// ---------- HEADER ----------

function renderHeader(doc: PDFKit.PDFDocument, title: string, numero: string, dateLabel: string, dateValue: string, cfg: Config): number {
  const topY = PAGE.margin;
  const headerHeight = 80;

  if (cfg.logo_path && fs.existsSync(cfg.logo_path)) {
    try {
      doc.image(cfg.logo_path, PAGE.margin, topY, { fit: [140, 60] });
    } catch {
      doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.text);
      singleLineText(doc, cfg.raison_sociale, PAGE.margin, topY + 10, 220);
    }
  } else {
    doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.text);
    singleLineText(doc, cfg.raison_sociale, PAGE.margin, topY + 10, 220);
  }

  const rightBlockX = PAGE.margin + 280;
  const rightBlockW = RIGHT_EDGE - rightBlockX;

  doc.fontSize(26).font('Helvetica-Bold').fillColor(COLORS.primary);
  singleLineText(doc, title, rightBlockX, topY + 2, rightBlockW, { align: 'right' });

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);
  singleLineText(doc, `N° ${numero}`, rightBlockX, topY + 38, rightBlockW, { align: 'right' });

  doc.fontSize(9).fillColor(COLORS.muted);
  singleLineText(doc, `${dateLabel} ${fmtDate(dateValue)}`, rightBlockX, topY + 54, rightBlockW, { align: 'right' });

  const endY = topY + headerHeight;
  drawLine(doc, PAGE.margin, endY + 6, RIGHT_EDGE, COLORS.border, 0.75);
  return endY + 18;
}

// ---------- ADDRESS BLOCKS ----------

function renderAddressBlocks(doc: PDFKit.PDFDocument, cfg: Config, client: Client, startY: number): number {
  const colW = (CONTENT_W - 30) / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colW + 30;

  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary);
  singleLineText(doc, 'DE', leftX, startY, colW);
  singleLineText(doc, 'FACTURÉ À', rightX, startY, colW);

  const nameY = startY + 14;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text);
  singleLineText(doc, cfg.raison_sociale, leftX, nameY, colW);
  const clientName = client.raison_sociale || `${client.nom}${client.prenom ? ' ' + client.prenom : ''}`;
  singleLineText(doc, clientName, rightX, nameY, colW);

  const lineHeight = 13;
  let ly = nameY + 18;
  let ry = nameY + 18;

  doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);

  const drawDetail = (text: string, x: number, y: number): number => {
    singleLineText(doc, text, x, y, colW);
    return y + lineHeight;
  };

  if (cfg.adresse) ly = drawDetail(cfg.adresse, leftX, ly);
  if (cfg.code_postal || cfg.ville) ly = drawDetail(`${cfg.code_postal ?? ''} ${cfg.ville ?? ''}`.trim(), leftX, ly);
  if (cfg.telephone) ly = drawDetail(cfg.telephone, leftX, ly);
  if (cfg.email) ly = drawDetail(cfg.email, leftX, ly);
  if (cfg.siret) ly = drawDetail(`SIRET : ${cfg.siret}`, leftX, ly);
  if (cfg.tva_intracommunautaire) ly = drawDetail(`TVA : ${cfg.tva_intracommunautaire}`, leftX, ly);

  if (client.adresse) ry = drawDetail(client.adresse, rightX, ry);
  if (client.code_postal || client.ville) ry = drawDetail(`${client.code_postal ?? ''} ${client.ville ?? ''}`.trim(), rightX, ry);
  if (client.telephone) ry = drawDetail(client.telephone, rightX, ry);
  if (client.email) ry = drawDetail(client.email, rightX, ry);
  if (client.type !== 'particulier' && client.siret) ry = drawDetail(`SIRET : ${client.siret}`, rightX, ry);

  return Math.max(ly, ry) + 12;
}

// ---------- OBJET ----------

function renderObjet(doc: PDFKit.PDFDocument, objet: string, meta: Array<[string, string]>, startY: number): number {
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary);
  singleLineText(doc, 'OBJET', PAGE.margin, startY, CONTENT_W);

  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text);
  singleLineText(doc, objet, PAGE.margin, startY + 14, CONTENT_W);

  let y = startY + 38;
  if (meta.length > 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);
    const parts = meta.map(([k, v]) => `${k} : ${v}`);
    singleLineText(doc, parts.join('   •   '), PAGE.margin, y, CONTENT_W);
    y += 14;
  }
  return y + 8;
}

// ---------- TABLE ----------

const TABLE_COLS = {
  designation: { x: 52, w: 230 },
  qte: { x: 292, w: 40 },
  unite: { x: 332, w: 40 },
  pu: { x: 378, w: 70 },
  tva: { x: 452, w: 35 },
  total: { x: 490, w: 65 },
} as const;
const TABLE_HEADER_H = 24;
const TABLE_PAD_X = 6;

function renderTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(PAGE.margin, y, CONTENT_W, TABLE_HEADER_H).fill(COLORS.primary);
  doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold');
  const textY = y + 9;

  singleLineText(doc, 'DÉSIGNATION', TABLE_COLS.designation.x, textY, TABLE_COLS.designation.w);
  singleLineText(doc, 'QTÉ', TABLE_COLS.qte.x, textY, TABLE_COLS.qte.w - TABLE_PAD_X, { align: 'right' });
  singleLineText(doc, 'UNITÉ', TABLE_COLS.unite.x + TABLE_PAD_X, textY, TABLE_COLS.unite.w - TABLE_PAD_X);
  singleLineText(doc, 'PU HT', TABLE_COLS.pu.x, textY, TABLE_COLS.pu.w - TABLE_PAD_X, { align: 'right' });
  singleLineText(doc, 'TVA', TABLE_COLS.tva.x, textY, TABLE_COLS.tva.w - TABLE_PAD_X, { align: 'right' });
  singleLineText(doc, 'TOTAL HT', TABLE_COLS.total.x, textY, TABLE_COLS.total.w - TABLE_PAD_X, { align: 'right' });

  return y + TABLE_HEADER_H;
}

function renderTableRow(doc: PDFKit.PDFDocument, l: Ligne, y: number, isOdd: boolean): number {
  const desigBase = 22;
  const descH = l.description && l.description.trim() ? 14 : 0;
  const rowH = desigBase + descH;

  if (isOdd) {
    doc.rect(PAGE.margin, y, CONTENT_W, rowH).fill(COLORS.primaryLight);
  }

  const valueY = y + 7;
  doc.font('Helvetica-Bold').fillColor(COLORS.text).fontSize(10);
  singleLineText(doc, l.designation, TABLE_COLS.designation.x, valueY, TABLE_COLS.designation.w - 8);

  if (l.description && l.description.trim()) {
    doc.font('Helvetica').fillColor(COLORS.muted).fontSize(8);
    singleLineText(doc, l.description, TABLE_COLS.designation.x, valueY + 12, TABLE_COLS.designation.w - 8);
  }

  doc.font('Helvetica').fillColor(COLORS.text).fontSize(10);
  singleLineText(doc, fmtNum(l.quantite), TABLE_COLS.qte.x, valueY, TABLE_COLS.qte.w - TABLE_PAD_X, { align: 'right' });
  singleLineText(doc, l.unite, TABLE_COLS.unite.x + TABLE_PAD_X, valueY, TABLE_COLS.unite.w - TABLE_PAD_X);
  singleLineText(doc, fmtEuroRaw(l.prix_unitaire_ht), TABLE_COLS.pu.x, valueY, TABLE_COLS.pu.w - TABLE_PAD_X, { align: 'right' });
  singleLineText(doc, `${fmtNum(l.taux_tva)} %`, TABLE_COLS.tva.x, valueY, TABLE_COLS.tva.w - TABLE_PAD_X, { align: 'right' });

  doc.font('Helvetica-Bold');
  singleLineText(doc, fmtEuroRaw(l.montant_ht), TABLE_COLS.total.x, valueY, TABLE_COLS.total.w - TABLE_PAD_X, { align: 'right' });

  const endY = y + rowH;
  drawLine(doc, PAGE.margin, endY, RIGHT_EDGE, COLORS.border, 0.3);
  return endY;
}

// Space reserved at the bottom of every page for footer + totals box
const PAGE_BOTTOM_RESERVE = 260;

function renderTable(doc: PDFKit.PDFDocument, lignes: Ligne[], startY: number): number {
  let y = renderTableHeader(doc, startY);
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const descH = l.description && l.description.trim() ? 14 : 0;
    const rowH = 22 + descH;

    // Break to next page if this row would collide with the footer area
    if (y + rowH > PAGE.height - PAGE_BOTTOM_RESERVE) {
      doc.addPage();
      y = renderTableHeader(doc, PAGE.margin);
    }

    y = renderTableRow(doc, l, y, i % 2 === 1);
  }
  return y + 16;
}

// ---------- TOTALS ----------

function renderTotals(
  doc: PDFKit.PDFDocument,
  totauxByTva: Record<string, number>,
  totalHT: number,
  totalTTC: number,
  startY: number,
  variant: 'devis' | 'facture',
  facturePaidInfo?: { paid: number; reste: number },
): number {
  const boxW = 260;
  const boxX = RIGHT_EDGE - boxW;
  const labelW = 140;
  const valueW = boxW - labelW - 8;
  const valueX = boxX + labelW + 8;
  let y = startY;

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);
  singleLineText(doc, 'Sous-total HT', boxX, y, labelW);
  singleLineText(doc, fmtEuroRaw(totalHT), valueX, y, valueW, { align: 'right' });
  y += 18;

  doc.fontSize(9).fillColor(COLORS.muted);
  for (const [tauxStr, montant] of Object.entries(totauxByTva)) {
    singleLineText(doc, `TVA ${fmtNum(Number(tauxStr))} %`, boxX, y, labelW);
    singleLineText(doc, fmtEuroRaw(montant), valueX, y, valueW, { align: 'right' });
    y += 15;
  }

  y += 6;
  drawLine(doc, boxX, y, boxX + boxW, COLORS.border, 0.5);
  y += 10;

  const bannerH = 36;
  doc.rect(boxX, y, boxW, bannerH).fill(COLORS.primary);
  const bannerTextY = y + 12;

  doc.fillColor(COLORS.white).fontSize(11).font('Helvetica-Bold');
  const label = variant === 'devis' ? 'TOTAL TTC' : 'TOTAL À PAYER';
  singleLineText(doc, label, boxX + 14, bannerTextY, labelW);

  doc.fontSize(14);
  singleLineText(doc, fmtEuroRaw(totalTTC), valueX, bannerTextY - 2, valueW - 14, { align: 'right' });
  y += bannerH + 10;

  if (facturePaidInfo && facturePaidInfo.paid > 0 && facturePaidInfo.reste > 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted);
    singleLineText(doc, 'Déjà payé', boxX, y, labelW);
    singleLineText(doc, fmtEuroRaw(facturePaidInfo.paid), valueX, y, valueW, { align: 'right' });
    y += 14;
    doc.font('Helvetica-Bold').fillColor(COLORS.text);
    singleLineText(doc, 'Reste dû', boxX, y, labelW);
    singleLineText(doc, fmtEuroRaw(facturePaidInfo.reste), valueX, y, valueW, { align: 'right' });
    y += 18;
  }

  return y;
}

// ---------- FOOTER ----------

function renderFooter(doc: PDFKit.PDFDocument, cfg: Config, conditionsPaiement: string, notes: string | null, variant: 'devis' | 'facture') {
  const bottomY = PAGE.height - 120;
  drawLine(doc, PAGE.margin, bottomY - 16, RIGHT_EDGE, COLORS.border, 0.5);

  const gap = 20;
  const colW = (CONTENT_W - gap * 2) / 3;
  const col1 = PAGE.margin;
  const col2 = PAGE.margin + colW + gap;
  const col3 = PAGE.margin + (colW + gap) * 2;

  if (notes) {
    const notesY = bottomY - 70;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary);
    singleLineText(doc, 'NOTES', PAGE.margin, notesY, CONTENT_W);
    doc.font('Helvetica').fillColor(COLORS.muted).fontSize(9);
    doc.text(notes, PAGE.margin, notesY + 12, { width: CONTENT_W, height: 40, ellipsis: true });
  }

  const headerY = bottomY;
  const bodyY = bottomY + 12;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary);
  singleLineText(doc, 'CONTACT', col1, headerY, colW);
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted);
  let cy = bodyY;
  if (cfg.email) { singleLineText(doc, cfg.email, col1, cy, colW); cy += 11; }
  if (cfg.telephone) { singleLineText(doc, cfg.telephone, col1, cy, colW); }

  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary);
  if (variant === 'facture' && cfg.iban) {
    singleLineText(doc, 'COORDONNÉES BANCAIRES', col2, headerY, colW);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted);
    singleLineText(doc, `IBAN : ${cfg.iban}`, col2, bodyY, colW);
    if (cfg.bic) singleLineText(doc, `BIC : ${cfg.bic}`, col2, bodyY + 11, colW);
  } else {
    singleLineText(doc, 'CONDITIONS', col2, headerY, colW);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted);
    doc.text(conditionsPaiement, col2, bodyY, { width: colW, height: 30, ellipsis: true });
  }

  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary);
  singleLineText(doc, 'MENTIONS LÉGALES', col3, headerY, colW);
  doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted);
  const legalText = [cfg.rcs, cfg.mentions_legales].filter(Boolean).join(' — ');
  doc.text(legalText || ' ', col3, bodyY, { width: colW, height: 40, ellipsis: true });
}

// ---------- TVA BREAKDOWN ----------

function computeTvaBreakdown(lignes: Ligne[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const l of lignes) {
    const key = String(l.taux_tva);
    map[key] = (map[key] ?? 0) + l.montant_tva;
  }
  for (const k of Object.keys(map)) map[k] = Math.round(map[k] * 100) / 100;
  return map;
}

// ---------- DEVIS ----------

export async function generateDevisPdf(devisId: number): Promise<string> {
  const db = getDb();
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(devisId) as Devis | undefined;
  if (!devis) throw new Error('Devis introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(devis.client_id) as Client | undefined;
  if (!client) throw new Error('Client introuvable pour ce devis');
  const lignes = db.prepare('SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY ordre').all(devisId) as Ligne[];
  const cfg = getConfig();

  const safeNumero = devis.numero.replace(/[^A-Za-z0-9_-]/g, '_');
  const outputPath = path.join(pdfOutputDir(), `Devis_${safeNumero}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE.margin,
      autoFirstPage: true,
      bufferPages: true,
    });
    const stream = fs.createWriteStream(outputPath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);

    const afterHeader = renderHeader(doc, 'DEVIS', devis.numero, 'Émis le', devis.date_emission, cfg);
    const afterAddr = renderAddressBlocks(doc, cfg, client, afterHeader);

    const meta: Array<[string, string]> = [['Valable jusqu\'au', fmtDate(devis.date_validite)]];
    if (devis.delai_realisation) meta.push(['Délai', devis.delai_realisation]);

    const afterObjet = renderObjet(doc, devis.objet, meta, afterAddr);
    let afterTable = renderTable(doc, lignes, afterObjet);
    if (afterTable + 200 > PAGE.height - 120) {
      doc.addPage();
      afterTable = PAGE.margin;
    }
    renderTotals(doc, computeTvaBreakdown(lignes), devis.total_ht, devis.total_ttc, afterTable, 'devis');
    renderFooter(doc, cfg, devis.conditions_paiement, devis.notes, 'devis');

    doc.flushPages();
    doc.end();
  });

  return outputPath;
}

// ---------- FACTURE ----------

export async function generateFacturePdf(factureId: number): Promise<string> {
  const db = getDb();
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId) as Facture | undefined;
  if (!facture) throw new Error('Facture introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(facture.client_id) as Client | undefined;
  if (!client) throw new Error('Client introuvable pour cette facture');
  const lignes = db.prepare('SELECT * FROM factures_lignes WHERE facture_id = ? ORDER BY ordre').all(factureId) as Ligne[];
  const cfg = getConfig();

  const safeNumero = facture.numero.replace(/[^A-Za-z0-9_-]/g, '_');
  const outputPath = path.join(pdfOutputDir(), `Facture_${safeNumero}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE.margin,
      autoFirstPage: true,
      bufferPages: true,
    });
    const stream = fs.createWriteStream(outputPath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);

    const afterHeader = renderHeader(doc, 'FACTURE', facture.numero, 'Émise le', facture.date_emission, cfg);
    const afterAddr = renderAddressBlocks(doc, cfg, client, afterHeader);

    const meta: Array<[string, string]> = [['Échéance', fmtDate(facture.date_echeance)]];
    if (facture.mode_paiement) meta.push(['Paiement', facture.mode_paiement]);
    if (facture.statut === 'payée' && facture.date_paiement) meta.push(['Payée le', fmtDate(facture.date_paiement)]);

    const afterObjet = renderObjet(doc, facture.objet, meta, afterAddr);

    if (facture.statut === 'payée') {
      doc.save();
      doc.rotate(-18, { origin: [400, 160] });
      doc.fontSize(48).fillColor(COLORS.success).opacity(0.18).font('Helvetica-Bold').text('PAYÉE', 330, 140, { lineBreak: false });
      doc.restore();
    }

    let afterTable = renderTable(doc, lignes, afterObjet);
    if (afterTable + 240 > PAGE.height - 120) {
      doc.addPage();
      afterTable = PAGE.margin;
    }

    const paidInfo = facture.montant_paye > 0 && facture.montant_paye < facture.total_ttc
      ? { paid: facture.montant_paye, reste: facture.total_ttc - facture.montant_paye }
      : undefined;

    renderTotals(doc, computeTvaBreakdown(lignes), facture.total_ht, facture.total_ttc, afterTable, 'facture', paidInfo);
    renderFooter(doc, cfg, facture.conditions_paiement, facture.notes, 'facture');

    doc.flushPages();
    doc.end();
  });

  return outputPath;
}
