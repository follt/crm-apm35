import { useEffect, useRef, useState } from 'react';
import { Save, Check, Upload, Trash2, ImageIcon, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ipc } from '@/lib/ipc';

interface EntrepriseConfig {
  raison_sociale: string;
  forme_juridique: string;
  siret: string | null;
  tva_intracommunautaire: string | null;
  rcs: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  iban: string | null;
  bic: string | null;
  conditions_generales: string | null;
  mentions_legales: string | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function EntrepriseSettings() {
  const [config, setConfig] = useState<EntrepriseConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const reloadLogo = () => {
    ipc.invoke<string | null>('config:get-logo-data-url').then(setLogoDataUrl).catch(() => setLogoDataUrl(null));
  };

  const reloadIcon = () => {
    ipc.invoke<string | null>('config:get-icon-data-url').then(setIconDataUrl).catch(() => setIconDataUrl(null));
  };

  useEffect(() => {
    ipc.invoke<EntrepriseConfig>('config:get-entreprise').then(setConfig).catch(console.error);
    reloadLogo();
    reloadIcon();
  }, []);

  const resizeImage = async (file: File, maxDim: number): Promise<{ bytes: Uint8Array; name: string }> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image illisible'));
        el.src = objectUrl;
      });

      const maxOrig = Math.max(img.width, img.height);
      const ratio = maxOrig > maxDim ? maxDim / maxOrig : 1;
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas non disponible');
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png', 0.92);
      });
      if (!blob) throw new Error('Conversion impossible');

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const baseName = file.name.replace(/\.[^.]+$/, '');
      return { bytes, name: `${baseName}.png` };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 20 Mo)');
      return;
    }
    setLogoUploading(true);
    try {
      const { bytes, name } = await resizeImage(file, 1600);
      await ipc.invoke('config:upload-logo', { name, data: bytes });
      reloadLogo();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLogoUploading(false);
    }
  };

  const deleteLogo = async () => {
    if (!confirm('Supprimer le logo ?')) return;
    await ipc.invoke('config:delete-logo');
    setLogoDataUrl(null);
  };

  const handleIconFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setIconUploading(true);
    try {
      const { bytes, name } = await resizeImage(file, 512);
      await ipc.invoke('config:upload-icon', { name, data: bytes });
      reloadIcon();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIconUploading(false);
    }
  };

  const deleteIcon = async () => {
    if (!confirm('Supprimer l\'icône ?')) return;
    await ipc.invoke('config:delete-icon');
    setIconDataUrl(null);
  };

  if (!config) return <div className="text-muted-foreground">Chargement…</div>;

  const update = <K extends keyof EntrepriseConfig>(key: K, value: EntrepriseConfig[K]) => {
    setConfig({ ...config, [key]: value });
    setSaved(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ipc.invoke('config:update-entreprise', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Informations légales</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Raison sociale *">
              <Input value={config.raison_sociale} onChange={(e) => update('raison_sociale', e.target.value)} required />
            </Field>
            <Field label="Forme juridique">
              <Input value={config.forme_juridique} onChange={(e) => update('forme_juridique', e.target.value)} />
            </Field>
            <Field label="SIRET">
              <Input value={config.siret ?? ''} onChange={(e) => update('siret', e.target.value)} placeholder="14 chiffres" />
            </Field>
            <Field label="TVA intracommunautaire">
              <Input value={config.tva_intracommunautaire ?? ''} onChange={(e) => update('tva_intracommunautaire', e.target.value)} placeholder="FR + 11 chiffres" />
            </Field>
            <Field label="RCS">
              <Input value={config.rcs ?? ''} onChange={(e) => update('rcs', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Coordonnées</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse">
              <Input value={config.adresse ?? ''} onChange={(e) => update('adresse', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code postal">
                <Input value={config.code_postal ?? ''} onChange={(e) => update('code_postal', e.target.value)} />
              </Field>
              <Field label="Ville">
                <Input value={config.ville ?? ''} onChange={(e) => update('ville', e.target.value)} />
              </Field>
            </div>
            <Field label="Téléphone">
              <Input value={config.telephone ?? ''} onChange={(e) => update('telephone', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={config.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Coordonnées bancaires</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="IBAN">
              <Input value={config.iban ?? ''} onChange={(e) => update('iban', e.target.value)} />
            </Field>
            <Field label="BIC">
              <Input value={config.bic ?? ''} onChange={(e) => update('bic', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Icône d'application</h3>
          <p className="text-sm text-muted-foreground">Petit logo carré affiché dans la sidebar (en haut à gauche) et comme icône de la fenêtre. Idéal : image carrée type 512×512. PNG ou JPG, max 10 Mo.</p>

          <div className="flex items-start gap-6">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed bg-muted/30">
              {iconDataUrl ? (
                <img src={iconDataUrl} alt="Icône" className="h-20 w-20 object-contain" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto mb-1 h-6 w-6 opacity-40" />
                  <p className="text-[10px]">Aucune icône</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleIconFile(file);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => iconInputRef.current?.click()}
                disabled={iconUploading}
              >
                <Upload className="h-4 w-4" />
                {iconUploading ? 'Envoi…' : iconDataUrl ? 'Changer l\'icône' : 'Ajouter une icône'}
              </Button>
              {iconDataUrl && (
                <Button type="button" variant="ghost" onClick={deleteIcon}>
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Logo PDF (bannière)</h3>
          <p className="text-sm text-muted-foreground">Apparaît en haut à gauche de tous les devis et factures PDF. Format libre (bannière, wide, etc.). PNG ou JPG, max 20 Mo.</p>

          <div className="flex items-start gap-6">
            <div className="flex h-32 w-48 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed bg-muted/30">
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="Logo" className="max-h-28 max-w-44 object-contain" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto mb-1 h-8 w-8 opacity-40" />
                  <p className="text-xs">Aucun logo</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
              >
                <Upload className="h-4 w-4" />
                {logoUploading ? 'Envoi…' : logoDataUrl ? 'Changer le logo' : 'Ajouter un logo'}
              </Button>
              {logoDataUrl && (
                <Button type="button" variant="ghost" onClick={deleteLogo}>
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-semibold">Documents</h3>
          <Field label="Conditions générales de vente">
            <Textarea rows={4} value={config.conditions_generales ?? ''} onChange={(e) => update('conditions_generales', e.target.value)} />
          </Field>
          <Field label="Mentions légales">
            <Textarea rows={3} value={config.mentions_legales ?? ''} onChange={(e) => update('mentions_legales', e.target.value)} />
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
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </Button>
      </div>

      <Card className="border-red-200">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-red-50 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900">Zone dangereuse</h3>
              <p className="mt-1 text-sm text-slate-500">
                Supprime toutes les données métier (clients, devis, factures, relances). Garde votre configuration (entreprise, logo, SMTP, catalogue).
                <br />
                Cette action est <strong>irréversible</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm('Supprimer TOUS les clients, devis, factures et relances ?\n\nLe catalogue et votre configuration sont conservés. Cette action est irréversible.')) return;
                await ipc.invoke('data:reset-business', { alsoCatalogue: false });
                alert('Données métier effacées. La page va recharger.');
                window.location.reload();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Effacer clients / devis / factures / relances
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm('Tout effacer : clients, devis, factures, relances ET catalogue ?\n\nSeule votre configuration (entreprise, SMTP, logo) sera conservée. Action irréversible.')) return;
                await ipc.invoke('data:reset-business', { alsoCatalogue: true });
                alert('Toutes les données métier effacées. La page va recharger.');
                window.location.reload();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Tout effacer (+ catalogue)
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
