import { contextBridge, ipcRenderer } from 'electron';

// Explicit allowlist of channels the renderer may invoke. Prevents a
// compromised renderer (XSS from a field or logo payload) from calling
// destructive handlers like `data:reset-business` without intent.
const ALLOWED_CHANNELS: ReadonlySet<string> = new Set([
  'dashboard:stats',

  'clients:list',
  'clients:get',
  'clients:create',
  'clients:update',
  'clients:delete',

  'catalogue:list',
  'catalogue:create',
  'catalogue:update',
  'catalogue:toggle',
  'catalogue:delete',

  'devis:list',
  'devis:get',
  'devis:create',
  'devis:update',
  'devis:delete',
  'devis:set-statut',
  'devis:pdf',
  'devis:send-email',
  'devis:email-defaults',
  'devis:to-facture',

  'factures:list',
  'factures:get',
  'factures:create',
  'factures:update',
  'factures:delete',
  'factures:mark-paid',
  'factures:partial-pay',
  'factures:set-statut',
  'factures:pdf',
  'factures:send-email',
  'factures:email-defaults',
  'factures:send-relance',

  'config:get-entreprise',
  'config:update-entreprise',
  'config:get-email',
  'config:update-email',
  'email:test',
  'config:upload-logo',
  'config:delete-logo',
  'config:get-logo-data-url',
  'config:upload-icon',
  'config:delete-icon',
  'config:get-icon-data-url',

  'data:reset-business',

  'shell:open-file',
]);

const api = {
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Canal IPC non autorisé : ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<T>;
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
