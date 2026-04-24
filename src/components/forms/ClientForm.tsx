import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ipc } from '@/lib/ipc';
import { clientSchema, type ClientPayload } from '@/lib/validation';

export interface ClientData {
  id?: number;
  type: 'particulier' | 'professionnel' | 'syndic';
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
}

const empty: ClientData = {
  type: 'particulier',
  nom: '',
  prenom: null,
  raison_sociale: null,
  email: null,
  telephone: null,
  adresse: null,
  code_postal: null,
  ville: null,
  siret: null,
  notes: null,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: ClientData | null;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ClientForm({ open, onClose, onSaved, editing }: Props) {
  const [data, setData] = useState<ClientData>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(editing ?? empty);
    setErrors({});
  }, [editing, open]);

  const update = <K extends keyof ClientData>(key: K, value: ClientData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = clientSchema.safeParse({
      type: data.type,
      nom: data.type === 'particulier' ? data.nom : (data.raison_sociale ?? ''),
      prenom: data.prenom ?? '',
      raison_sociale: data.raison_sociale ?? '',
      email: data.email ?? '',
      telephone: data.telephone ?? '',
      adresse: data.adresse ?? '',
      code_postal: data.code_postal ?? '',
      ville: data.ville ?? '',
      siret: data.siret ?? '',
      notes: data.notes ?? '',
    });

    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        flat[issue.path.join('.')] = issue.message;
      }
      setErrors(flat);
      return;
    }

    setSaving(true);
    try {
      const payload: ClientPayload = parsed.data;
      if (editing?.id) {
        await ipc.invoke('clients:update', editing.id, payload);
      } else {
        await ipc.invoke('clients:create', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ _general: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const isPro = data.type !== 'particulier';

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le client' : 'Nouveau client'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type de client">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
            {(['particulier', 'professionnel', 'syndic'] as const).map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium capitalize transition-all ${
                  data.type === t
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <input type="radio" value={t} checked={data.type === t} onChange={() => update('type', t)} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </Field>

        {!isPro && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom *" error={errors.nom}>
              <Input value={data.nom} onChange={(e) => update('nom', e.target.value)} required />
            </Field>
            <Field label="Prénom">
              <Input value={data.prenom ?? ''} onChange={(e) => update('prenom', e.target.value || null)} />
            </Field>
          </div>
        )}

        {isPro && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Raison sociale *" error={errors.raison_sociale}>
              <Input value={data.raison_sociale ?? ''} onChange={(e) => update('raison_sociale', e.target.value || null)} required />
            </Field>
            <Field label="SIRET" error={errors.siret}>
              <Input value={data.siret ?? ''} onChange={(e) => update('siret', e.target.value || null)} placeholder="14 chiffres" />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" error={errors.email}>
            <Input type="email" value={data.email ?? ''} onChange={(e) => update('email', e.target.value || null)} />
          </Field>
          <Field label="Téléphone" error={errors.telephone}>
            <Input value={data.telephone ?? ''} onChange={(e) => update('telephone', e.target.value || null)} placeholder="06 XX XX XX XX" />
          </Field>
        </div>

        <Field label="Adresse">
          <Input value={data.adresse ?? ''} onChange={(e) => update('adresse', e.target.value || null)} />
        </Field>

        <div className="grid grid-cols-[1fr_2fr] gap-4">
          <Field label="Code postal">
            <Input value={data.code_postal ?? ''} onChange={(e) => update('code_postal', e.target.value || null)} />
          </Field>
          <Field label="Ville">
            <Input value={data.ville ?? ''} onChange={(e) => update('ville', e.target.value || null)} />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea rows={2} value={data.notes ?? ''} onChange={(e) => update('notes', e.target.value || null)} />
        </Field>

        {errors._general && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {errors._general}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
