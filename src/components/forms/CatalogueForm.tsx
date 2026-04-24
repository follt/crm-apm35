import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ipc } from '@/lib/ipc';

export interface ProduitData {
  id?: number;
  categorie: 'placo' | 'isolation' | 'menuiserie' | 'main_oeuvre' | 'autre';
  designation: string;
  description: string | null;
  unite: 'm²' | 'm' | 'unité' | 'forfait' | 'heure';
  prix_ht: number;
  taux_tva: number;
  actif: boolean;
}

const empty: ProduitData = {
  categorie: 'placo',
  designation: '',
  description: null,
  unite: 'm²',
  prix_ht: 0,
  taux_tva: 20,
  actif: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: ProduitData | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CatalogueForm({ open, onClose, onSaved, editing }: Props) {
  const [data, setData] = useState<ProduitData>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(editing ?? empty);
    setError(null);
  }, [editing, open]);

  const update = <K extends keyof ProduitData>(key: K, value: ProduitData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing?.id) {
        await ipc.invoke('catalogue:update', editing.id, data);
      } else {
        await ipc.invoke('catalogue:create', data);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le produit' : 'Nouveau produit'} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Catégorie *">
          <Select value={data.categorie} onChange={(e) => update('categorie', e.target.value as ProduitData['categorie'])}>
            <option value="placo">Placo</option>
            <option value="isolation">Isolation</option>
            <option value="menuiserie">Menuiserie</option>
            <option value="main_oeuvre">Main d'œuvre</option>
            <option value="autre">Autre</option>
          </Select>
        </Field>

        <Field label="Désignation *">
          <Input value={data.designation} onChange={(e) => update('designation', e.target.value)} required />
        </Field>

        <Field label="Description">
          <Textarea rows={2} value={data.description ?? ''} onChange={(e) => update('description', e.target.value || null)} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Prix HT *">
            <Input type="number" step="0.01" min="0" value={data.prix_ht} onChange={(e) => update('prix_ht', Number(e.target.value))} required />
          </Field>
          <Field label="Unité *">
            <Select value={data.unite} onChange={(e) => update('unite', e.target.value as ProduitData['unite'])}>
              <option value="m²">m²</option>
              <option value="m">m</option>
              <option value="unité">unité</option>
              <option value="forfait">forfait</option>
              <option value="heure">heure</option>
            </Select>
          </Field>
          <Field label="TVA *">
            <Select value={data.taux_tva} onChange={(e) => update('taux_tva', Number(e.target.value))}>
              <option value={20}>20%</option>
              <option value={10}>10%</option>
              <option value={5.5}>5,5%</option>
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={data.actif} onChange={(e) => update('actif', e.target.checked)} className="h-4 w-4" />
          Produit actif (visible dans le catalogue)
        </label>

        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
