import nodemailer, { type Transporter } from 'nodemailer';
import { getDb } from '../db/database.js';
import { secrets } from './secrets.js';
import { generateDevisPdf, generateFacturePdf } from './pdf.service.js';
import type { Client, Devis, Facture } from '../db/schema.js';

export interface EmailConfig {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: number;
  smtp_user: string | null;
  email_from: string | null;
  signature_html: string | null;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; path: string }>;
}

function buildTransporter(): Transporter {
  const config = getDb()
    .prepare('SELECT smtp_host, smtp_port, smtp_secure, smtp_user FROM email_config WHERE id = 1')
    .get() as Pick<EmailConfig, 'smtp_host' | 'smtp_port' | 'smtp_secure' | 'smtp_user'> | undefined;

  if (!config?.smtp_host || !config.smtp_port || !config.smtp_user) {
    throw new Error('Configuration SMTP incomplète (serveur, port ou identifiant manquant)');
  }

  const rawPassword = secrets.getSmtpPassword();
  if (!rawPassword) {
    throw new Error('Mot de passe SMTP non configuré');
  }
  const password = rawPassword.replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_secure === 1,
    auth: { user: config.smtp_user.trim(), pass: password },
  });
}

function getFrom(): string {
  const row = getDb()
    .prepare('SELECT email_from FROM email_config WHERE id = 1')
    .get() as { email_from: string | null } | undefined;
  if (!row?.email_from) throw new Error('Email expéditeur non configuré');
  return row.email_from;
}

function getSignature(): string {
  const row = getDb()
    .prepare('SELECT signature_html FROM email_config WHERE id = 1')
    .get() as { signature_html: string | null } | undefined;
  return row?.signature_html ?? '';
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const transporter = buildTransporter();
  await transporter.sendMail({
    from: getFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });
}

export async function testEmailConnection(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = buildTransporter();
    await transporter.verify();

    await transporter.sendMail({
      from: getFrom(),
      to,
      subject: '[Test] Configuration SMTP Gestion SARL Bâtiment',
      html: `
        <p>Bonjour,</p>
        <p>Cet email confirme que la configuration SMTP de votre application <strong>Gestion SARL Bâtiment</strong> fonctionne correctement.</p>
        <p>Vous pouvez désormais envoyer devis, factures et relances depuis l'application.</p>
        <p style="color:#888;font-size:12px">Envoyé le ${new Date().toLocaleString('fr-FR')}</p>
      `,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function clientCivilite(c: Client): string {
  if (c.type !== 'particulier') return '';
  return 'Bonjour';
}

function clientDisplayName(c: Client): string {
  if (c.raison_sociale) return c.raison_sociale;
  return `${c.nom}${c.prenom ? ' ' + c.prenom : ''}`;
}

function fmtDate(s: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(s));
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

export interface SendOverride {
  to?: string;
  subject?: string;
  message?: string;
}

export function buildDefaultDevisEmail(devisId: number): { to: string | null; subject: string; message: string } {
  const db = getDb();
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(devisId) as Devis | undefined;
  if (!devis) throw new Error('Devis introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(devis.client_id) as Client | undefined;
  if (!client) throw new Error('Client introuvable');

  const subject = `Devis N° ${devis.numero} — ${devis.objet}`;
  const message =
    `Bonjour,\n\n` +
    `Suite à notre échange, vous trouverez ci-joint le devis N° ${devis.numero} relatif à ${devis.objet}.\n\n` +
    `Ce devis détaille l'ensemble des prestations et matériaux prévus ainsi que les conditions de réalisation. Il est valable jusqu'au ${fmtDate(devis.date_validite)}.\n\n` +
    `Pour valider l'intervention, merci de nous retourner ce devis daté, signé et portant la mention « bon pour accord ».\n\n` +
    `Je reste à votre disposition pour toute précision ou ajustement.\n\n` +
    `Bien cordialement,`;
  return { to: client.email, subject, message };
}

function textToHtml(message: string): string {
  return message
    .split('\n')
    .map((line) => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0">${escapeHtml(line)}</p>`)
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendDevisByEmail(devisId: number, override?: SendOverride): Promise<{ to: string }> {
  const db = getDb();
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(devisId) as Devis | undefined;
  if (!devis) throw new Error('Devis introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(devis.client_id) as Client;

  const to = (override?.to || client.email)?.trim();
  if (!to) throw new Error('Aucune adresse email destinataire');

  const defaults = buildDefaultDevisEmail(devisId);
  const subject = override?.subject?.trim() || defaults.subject;
  const messageText = override?.message?.trim() || defaults.message;

  const pdfPath = await generateDevisPdf(devisId);

  const html = `${textToHtml(messageText)}${getSignature()}`;

  await sendEmail({
    to,
    subject,
    html,
    attachments: [{ filename: `Devis_${devis.numero}.pdf`, path: pdfPath }],
  });

  return { to };
}

export function buildDefaultFactureEmail(factureId: number): { to: string | null; subject: string; message: string } {
  const db = getDb();
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId) as Facture | undefined;
  if (!facture) throw new Error('Facture introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(facture.client_id) as Client | undefined;
  if (!client) throw new Error('Client introuvable');
  const cfg = db.prepare('SELECT iban, bic FROM configuration WHERE id = 1').get() as { iban: string | null; bic: string | null } | undefined;

  const subject = `Facture N° ${facture.numero} — ${facture.objet}`;

  const bankLines = cfg?.iban
    ? `\n\nCoordonnées bancaires :\nIBAN : ${cfg.iban}${cfg.bic ? `\nBIC : ${cfg.bic}` : ''}\n\nMerci d'indiquer le numéro de facture en référence du virement.`
    : '';

  const message =
    `Bonjour,\n\n` +
    `Comme convenu, vous trouverez ci-jointe la facture N° ${facture.numero} d'un montant de ${fmtEuro(facture.total_ttc)} TTC, correspondant à ${facture.objet}.\n\n` +
    `Échéance de paiement : ${fmtDate(facture.date_echeance)}\n` +
    `Modalités : ${facture.conditions_paiement}${bankLines}\n\n` +
    `Nous vous remercions de votre confiance et restons à votre disposition pour toute question.\n\n` +
    `Bien cordialement,`;

  return { to: client.email, subject, message };
}

export async function sendFactureByEmail(factureId: number, override?: SendOverride): Promise<{ to: string }> {
  const db = getDb();
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId) as Facture | undefined;
  if (!facture) throw new Error('Facture introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(facture.client_id) as Client;

  const to = (override?.to || client.email)?.trim();
  if (!to) throw new Error('Aucune adresse email destinataire');

  const defaults = buildDefaultFactureEmail(factureId);
  const subject = override?.subject?.trim() || defaults.subject;
  const messageText = override?.message?.trim() || defaults.message;

  const pdfPath = await generateFacturePdf(factureId);

  const html = `${textToHtml(messageText)}${getSignature()}`;

  await sendEmail({
    to,
    subject,
    html,
    attachments: [{ filename: `Facture_${facture.numero}.pdf`, path: pdfPath }],
  });

  return { to };
}

export async function sendRelanceByEmail(
  factureId: number,
  type: 'automatique' | 'manuelle',
): Promise<{ niveau: number; to: string }> {
  const db = getDb();
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId) as Facture | undefined;
  if (!facture) throw new Error('Facture introuvable');
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(facture.client_id) as Client;

  const to = client.email;
  if (!to) throw new Error('Client sans email');

  const last = db.prepare('SELECT MAX(niveau) as niveau FROM relances WHERE facture_id = ?').get(factureId) as { niveau: number | null };
  const niveau = Math.min(3, (last.niveau ?? 0) + 1);

  const cfg = db.prepare('SELECT template_niveau_1, template_niveau_2, template_niveau_3 FROM relances_config WHERE id = 1').get() as {
    template_niveau_1: string;
    template_niveau_2: string;
    template_niveau_3: string;
  };

  const template = niveau === 1 ? cfg.template_niveau_1 : niveau === 2 ? cfg.template_niveau_2 : cfg.template_niveau_3;

  const joursRetard = Math.floor((Date.now() - new Date(facture.date_echeance).getTime()) / (1000 * 60 * 60 * 24));
  const montantDu = facture.total_ttc - facture.montant_paye;

  const body = template
    .replace(/\{numero\}/g, facture.numero)
    .replace(/\{montant_du\}/g, fmtEuro(montantDu))
    .replace(/\{date_echeance\}/g, fmtDate(facture.date_echeance))
    .replace(/\{jours_retard\}/g, String(joursRetard))
    .replace(/\{civilite\}/g, clientCivilite(client) || '')
    .replace(/\{nom\}/g, clientDisplayName(client));

  const html = body.split('\n').map((l) => l ? `<p>${l}</p>` : '<br/>').join('') + getSignature();

  const subject = niveau === 1
    ? `Rappel — Facture N° ${facture.numero} échue le ${fmtDate(facture.date_echeance)}`
    : niveau === 2
    ? `2ᵉ rappel — Facture N° ${facture.numero} impayée (${joursRetard} jours de retard)`
    : `MISE EN DEMEURE — Facture N° ${facture.numero}`;

  try {
    await sendEmail({ to, subject, html });
    db.prepare(`
      INSERT INTO relances (facture_id, type, date_envoi, niveau, email_destinataire, statut)
      VALUES (?, ?, ?, ?, ?, 'envoyée')
    `).run(factureId, type, new Date().toISOString(), niveau, to);
    return { niveau, to };
  } catch (e) {
    db.prepare(`
      INSERT INTO relances (facture_id, type, date_envoi, niveau, email_destinataire, statut)
      VALUES (?, ?, ?, ?, ?, 'échouée')
    `).run(factureId, type, new Date().toISOString(), niveau, to);
    throw e;
  }
}
