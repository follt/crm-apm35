import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, Package, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ipc } from '@/lib/ipc';
import { formatEuros, cn } from '@/lib/utils';

interface Client {
  id: number;
  type: 'particulier' | 'professionnel' | 'syndic';
  nom: string;
  prenom: string | null;
  raison_sociale: string | null;
}

interface Produit {
  id: number;
  categorie: 'placo' | 'isolation' | 'menuiserie' | 'main_oeuvre' | 'autre';
  designation: string;
  description: string | null;
  unite: string;
  prix_ht: number;
  taux_tva: number;
}

interface Ligne {
  designation: string;
  description: string | null;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: number;
}

function tvaFor(clientType: Client['type'], categorie: Produit['categorie']): number {
  if (clientType !== 'particulier') return 20;
  if (categorie === 'isolation' || categorie === 'menuiserie') return 5.5;
  if (categorie === 'placo' || categorie === 'main_oeuvre') return 10;
  return 20;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function FactureForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | ''>('');
  const [dateEmission, setDateEmission] = useState(todayISO());
  const [dateEcheance, setDateEcheance] = useState(addDaysISO(30));
  const [objet, setObjet] = useState('');
  const [conditions, setConditions] = useState('À réception de facture');
  const [modePaiement, setModePaiement] = useState('Virement');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<Produit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ipc.invoke<Client[]>('clients:list').then(setClients);
    ipc.invoke<Produit[]>('catalogue:list').then(setCatalogue);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    ipc.invoke<{ facture: { client_id: number; date_emission: string; date_echeance: string; objet: string; conditions_paiement: string; mode_paiement: string | null; notes: string | null }; lignes: Ligne[] }>('factures:get', Number(id))
      .then((d) => {
        setClientId(d.facture.client_id);
        setDateEmission(d.facture.date_emission);
        setDateEcheance(d.facture.date_echeance);
        setObjet(d.facture.objet);
        setConditions(d.facture.conditions_paiement);
        setModePaiement(d.facture.mode_paiement ?? 'Virement');
        setNotes(d.facture.notes ?? '');
        setLignes(d.lignes.map((l) => ({
          designation: l.designation,
          description: l.description,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          taux_tva: l.taux_tva,
        })));
      });
  }, [id, isEdit]);

  const currentClient = clients.find((c) => c.id === clientId);

  const totaux = useMemo(() => {
    let ht = 0;
    const byTva: Record<string, number> = {};
    for (const l of lignes) {
      const mht = l.quantite * l.prix_unitaire_ht;
      const mtva = mht * (l.taux_tva / 100);
      ht += mht;
      byTva[String(l.taux_tva)] = (byTva[String(l.taux_tva)] ?? 0) + mtva;
    }
    const tva = Object.values(byTva).reduce((a, b) => a + b, 0);
    return { ht, byTva, tva, ttc: ht + tva };
  }, [lignes]);

  const addFromCatalogue = (p: Produit) => {
    const taux = currentClient ? tvaFor(currentClient.type, p.categorie) : p.taux_tva;
    setLignes([...lignes, {
      designation: p.designation,
      description: p.description,
      quantite: 1,
      unite: p.unite,
      prix_unitaire_ht: p.prix_ht,
      taux_tva: taux,
    }]);
    setCatalogueOpen(false);
  };

  const addCustom = () => {
    setLignes([...lignes, {
      designation: '',
      description: null,
      quantite: 1,
      unite: 'unité',
      prix_unitaire_ht: 0,
      taux_tva: 20,
    }]);
  };

  const updateLigne = (idx: number, patch: Partial<Ligne>) => {
    setLignes(lignes.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const removeLigne = (idx: number) => setLignes(lignes.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!clientId) return setError('Client requis');
    if (!objet.trim()) return setError('Objet requis');
    if (lignes.length === 0) return setError('Au moins une ligne requise');
    setError(null);
    setSaving(true);
    try {
      const payload = {
        client_id: Number(clientId),
        date_emission: dateEmission,
        date_echeance: dateEcheance,
        objet,
        conditions_paiement: conditions,
        mode_paiement: modePaiement,
        notes: notes || null,
        lignes,
      };
      if (isEdit) {
        await ipc.invoke('factures:update', Number(id), payload);
      } else {
        await ipc.invoke('factures:create', payload);
      }
      navigate('/factures');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/factures')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Modifier la facture' : 'Nouvelle facture'}</h1>
          <p className="text-sm text-muted-foreground">
            {currentClient && `Client : ${currentClient.raison_sociale || currentClient.nom}`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="text-base font-semibold">Informations générales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Client *</Label>
                  {clients.length === 0 ? (
                    <Link
                      to="/clients"
                      className="flex items-center gap-2 rounded-md border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-700 hover:bg-blue-100"
                    >
                      <UserPlus className="h-4 w-4" />
                      Aucun client enregistré — créez-en un d'abord
                    </Link>
                  ) : (
                    <Select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">— Sélectionner un client —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.raison_sociale || `${c.nom}${c.prenom ? ' ' + c.prenom : ''}`} ({c.type})
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Date d'émission *</Label>
                  <Input type="date" value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date d'échéance *</Label>
                  <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Objet *</Label>
                  <Input value={objet} onChange={(e) => setObjet(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Conditions de paiement</Label>
                  <Input value={conditions} onChange={(e) => setConditions(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mode de paiement</Label>
                  <Select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Espèces">Espèces</option>
                    <option value="CB">CB</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Lignes de la facture</h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCatalogueOpen(true)}>
                    <Package className="h-4 w-4" /> Depuis catalogue
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addCustom}>
                    <Plus className="h-4 w-4" /> Ligne personnalisée
                  </Button>
                </div>
              </div>

              {lignes.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Aucune ligne.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="pb-2 pr-2 font-medium">Désignation</th>
                        <th className="pb-2 pr-2 font-medium">Qté</th>
                        <th className="pb-2 pr-2 font-medium">Unité</th>
                        <th className="pb-2 pr-2 font-medium">PU HT</th>
                        <th className="pb-2 pr-2 font-medium">TVA</th>
                        <th className="pb-2 pr-2 text-right font-medium">Total HT</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l, i) => {
                        const total = l.quantite * l.prix_unitaire_ht;
                        return (
                          <tr key={i} className="border-b align-top">
                            <td className="py-2 pr-2">
                              <Input
                                value={l.designation}
                                onChange={(e) => updateLigne(i, { designation: e.target.value })}
                              />
                              <Textarea
                                rows={1}
                                value={l.description ?? ''}
                                onChange={(e) => updateLigne(i, { description: e.target.value || null })}
                                placeholder="Description"
                                className="mt-1 min-h-[30px] text-xs"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input type="number" step="0.01" className="w-20" value={l.quantite} onChange={(e) => {
                                const n = Number(e.target.value);
                                updateLigne(i, { quantite: Number.isFinite(n) && n >= 0 ? n : 0 });
                              }} />
                            </td>
                            <td className="py-2 pr-2">
                              <Select value={l.unite} onChange={(e) => updateLigne(i, { unite: e.target.value })} className="w-24">
                                <option value="m²">m²</option>
                                <option value="m">m</option>
                                <option value="unité">unité</option>
                                <option value="forfait">forfait</option>
                                <option value="heure">heure</option>
                              </Select>
                            </td>
                            <td className="py-2 pr-2">
                              <Input type="number" step="0.01" className="w-24" value={l.prix_unitaire_ht} onChange={(e) => {
                                const n = Number(e.target.value);
                                updateLigne(i, { prix_unitaire_ht: Number.isFinite(n) && n >= 0 ? n : 0 });
                              }} />
                            </td>
                            <td className="py-2 pr-2">
                              <Select value={l.taux_tva} onChange={(e) => updateLigne(i, { taux_tva: Number(e.target.value) })} className="w-20">
                                <option value={20}>20%</option>
                                <option value={10}>10%</option>
                                <option value={5.5}>5,5%</option>
                              </Select>
                            </td>
                            <td className="py-2 pr-2 text-right font-medium">{formatEuros(total)}</td>
                            <td className="py-2">
                              <Button variant="ghost" size="icon" type="button" onClick={() => removeLigne(i)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="text-base font-semibold">Notes</h3>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardContent className="space-y-2 p-5">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Récapitulatif</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">{formatEuros(totaux.ht)}</span>
              </div>
              {Object.entries(totaux.byTva).map(([taux, montant]) => (
                <div key={taux} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA {taux}%</span>
                  <span>{formatEuros(montant)}</span>
                </div>
              ))}
              <div className="border-t pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Total TTC</span>
                  <span className="text-lg font-bold">{formatEuros(totaux.ttc)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <Button onClick={submit} disabled={saving} className="w-full">
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Enregistrer (brouillon)'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/factures')} className="w-full">
            Annuler
          </Button>
        </div>
      </div>

      <Modal open={catalogueOpen} onClose={() => setCatalogueOpen(false)} title="Ajouter depuis le catalogue" size="xl">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left">
                <th className="p-2 font-medium">Catégorie</th>
                <th className="p-2 font-medium">Désignation</th>
                <th className="p-2 font-medium">Unité</th>
                <th className="p-2 text-right font-medium">Prix HT</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {catalogue.map((p) => (
                <tr key={p.id} className={cn('border-b hover:bg-muted/40')}>
                  <td className="p-2 text-xs capitalize text-muted-foreground">{p.categorie.replace('_', ' ')}</td>
                  <td className="p-2">
                    <div className="font-medium">{p.designation}</div>
                    {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                  </td>
                  <td className="p-2 text-muted-foreground">{p.unite}</td>
                  <td className="p-2 text-right">{formatEuros(p.prix_ht)}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" type="button" onClick={() => addFromCatalogue(p)}>Ajouter</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
