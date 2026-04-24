import { useEffect, useState } from 'react';
import { Save, Send, Check, AlertTriangle, KeyRound, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ipc } from '@/lib/ipc';

interface EmailConfigView {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  email_from: string;
  signature_html: string;
  has_password: boolean;
}

interface EmailConfigPayload {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password?: string;
  email_from: string;
  signature_html: string;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function EmailSettings() {
  const [config, setConfig] = useState<EmailConfigView | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testTo, setTestTo] = useState('evan.boisseau2004@gmail.com');

  useEffect(() => {
    ipc.invoke<EmailConfigView>('config:get-email').then(setConfig).catch(console.error);
  }, []);

  if (!config) return <div className="text-muted-foreground">Chargement…</div>;

  const update = <K extends keyof EmailConfigView>(key: K, value: EmailConfigView[K]) => {
    setConfig({ ...config, [key]: value });
    setSaved(false);
    setTestResult(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: EmailConfigPayload = {
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_secure: config.smtp_secure,
        smtp_user: config.smtp_user,
        email_from: config.email_from,
        signature_html: config.signature_html,
      };
      if (newPassword.length > 0) payload.smtp_password = newPassword;

      const result = await ipc.invoke<{ ok: boolean; has_password: boolean }>('config:update-email', payload);
      setConfig({ ...config, has_password: result.has_password });
      setNewPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!testTo) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await ipc.invoke<{ ok: true } | { ok: false; error: string }>('email:test', testTo);
      if (result.ok) {
        setTestResult({ ok: true, message: `Email de test envoyé à ${testTo}` });
      } else {
        setTestResult({ ok: false, message: result.error });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Gmail : mot de passe d'application requis</p>
          <p>
            Depuis 2022, Gmail n'accepte plus votre mot de passe normal pour SMTP. Activez la{' '}
            <span className="font-medium">double authentification</span> sur votre compte Google, puis générez un{' '}
            <span className="font-medium">mot de passe d'application</span> dédié à cette app.
          </p>
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
          >
            Générer un mot de passe d'application
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-base font-semibold">Serveur SMTP</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Serveur SMTP *" hint="Gmail : smtp.gmail.com">
                <Input value={config.smtp_host} onChange={(e) => update('smtp_host', e.target.value)} required />
              </Field>
              <Field label="Port *" hint="587 (TLS) ou 465 (SSL)">
                <Input
                  type="number"
                  value={config.smtp_port}
                  onChange={(e) => update('smtp_port', Number(e.target.value))}
                  required
                />
              </Field>
              <Field label="Sécurité">
                <select
                  value={config.smtp_secure ? 'ssl' : 'tls'}
                  onChange={(e) => update('smtp_secure', e.target.value === 'ssl')}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="tls">TLS (port 587 — recommandé pour Gmail)</option>
                  <option value="ssl">SSL (port 465)</option>
                </select>
              </Field>
              <Field label="Identifiant *" hint="Votre adresse Gmail complète">
                <Input value={config.smtp_user} onChange={(e) => update('smtp_user', e.target.value)} required />
              </Field>
            </div>
            <Field
              label={config.has_password ? 'Mot de passe — déjà configuré' : 'Mot de passe d\'application *'}
              hint={config.has_password ? 'Laissez vide pour conserver l\'actuel. Remplissez pour le remplacer.' : '16 caractères générés par Google'}
            >
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={config.has_password ? '••••••••••••••••' : 'xxxx xxxx xxxx xxxx'}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Email expéditeur *" hint="Adresse affichée comme expéditeur">
              <Input type="email" value={config.email_from} onChange={(e) => update('email_from', e.target.value)} required />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-base font-semibold">Signature email</h3>
            <Field label="Signature HTML" hint="Apparaît en bas de tous les emails automatiques">
              <Textarea rows={4} value={config.signature_html} onChange={(e) => update('signature_html', e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="h-4 w-4" /> Enregistré
            </span>
          )}
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Tester la configuration</h3>
          <p className="text-sm text-muted-foreground">
            Envoie un email de test pour vérifier que la connexion SMTP fonctionne.
            {!config.has_password && ' Enregistrez d\'abord un mot de passe d\'application ci-dessus.'}
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="destinataire@example.com"
              className="max-w-md"
            />
            <Button type="button" onClick={runTest} disabled={testing || !testTo || !config.has_password} variant="outline">
              <Send className="h-4 w-4" />
              {testing ? 'Envoi…' : 'Envoyer test'}
            </Button>
          </div>
          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                testResult.ok
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {testResult.ok ? <Check className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
