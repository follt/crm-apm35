import { z } from 'zod';

const optString = (s: string) => (s.trim() === '' ? null : s.trim());

const siretRegex = /^\d{14}$/;
const phoneRegex = /^0[1-9]\d{8}$/;

export const clientSchema = z
  .object({
    type: z.enum(['particulier', 'professionnel', 'syndic']),
    nom: z.string().min(1, 'Nom requis'),
    prenom: z.string().optional().transform((v) => optString(v ?? '')),
    raison_sociale: z.string().optional().transform((v) => optString(v ?? '')),
    email: z
      .string()
      .optional()
      .transform((v) => optString(v ?? ''))
      .refine((v) => !v || z.string().email().safeParse(v).success, 'Email invalide'),
    telephone: z
      .string()
      .optional()
      .transform((v) => optString((v ?? '').replace(/[\s\-.]/g, '')))
      .refine((v) => !v || phoneRegex.test(v), 'Téléphone français attendu (10 chiffres, commence par 0)'),
    adresse: z.string().optional().transform((v) => optString(v ?? '')),
    code_postal: z.string().optional().transform((v) => optString(v ?? '')),
    ville: z.string().optional().transform((v) => optString(v ?? '')),
    siret: z
      .string()
      .optional()
      .transform((v) => optString((v ?? '').replace(/\s/g, '')))
      .refine((v) => !v || siretRegex.test(v), 'SIRET doit contenir 14 chiffres'),
    notes: z.string().optional().transform((v) => optString(v ?? '')),
  })
  .refine((d) => d.type === 'particulier' ? !!d.nom : !!d.raison_sociale, {
    message: 'Nom ou raison sociale requis selon le type',
    path: ['raison_sociale'],
  });

export type ClientInput = z.input<typeof clientSchema>;
export type ClientPayload = z.output<typeof clientSchema>;

export const catalogueSchema = z.object({
  categorie: z.enum(['placo', 'isolation', 'menuiserie', 'main_oeuvre', 'autre']),
  designation: z.string().min(1, 'Désignation requise'),
  description: z.string().optional().transform((v) => optString(v ?? '')),
  unite: z.enum(['m²', 'm', 'unité', 'forfait', 'heure']),
  prix_ht: z.coerce.number().min(0, 'Prix HT doit être ≥ 0'),
  taux_tva: z.coerce.number().refine((v) => [20, 10, 5.5].includes(v), 'TVA autorisée : 20%, 10%, 5.5%'),
  actif: z.coerce.boolean().default(true),
});

export type CatalogueInput = z.input<typeof catalogueSchema>;
export type CataloguePayload = z.output<typeof catalogueSchema>;

export const devisLigneSchema = z.object({
  designation: z.string().min(1),
  description: z.string().nullable().optional(),
  quantite: z.coerce.number().positive(),
  unite: z.string().min(1),
  prix_unitaire_ht: z.coerce.number().min(0),
  taux_tva: z.coerce.number(),
});

export const devisSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  date_emission: z.string().min(1),
  date_validite: z.string().min(1),
  objet: z.string().min(1, 'Objet requis'),
  delai_realisation: z.string().optional().transform((v) => optString(v ?? '')),
  conditions_paiement: z.string().default('À réception de facture'),
  notes: z.string().optional().transform((v) => optString(v ?? '')),
  lignes: z.array(devisLigneSchema).min(1, 'Au moins une ligne requise'),
});

export type DevisInput = z.input<typeof devisSchema>;
export type DevisPayload = z.output<typeof devisSchema>;
