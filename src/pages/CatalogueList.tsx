import { useEffect, useMemo, useState } from 'react';
import { Package, Pencil, Trash2, Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { CatalogueForm, type ProduitData } from '@/components/forms/CatalogueForm';
import { ipc } from '@/lib/ipc';
import { formatEuros } from '@/lib/utils';

interface Produit {
  id: number;
  categorie: ProduitData['categorie'];
  designation: string;
  description: string | null;
  unite: ProduitData['unite'];
  prix_ht: number;
  taux_tva: number;
  actif: number;
}

const categorieLabel: Record<Produit['categorie'], string> = {
  placo: 'Placo',
  isolation: 'Isolation',
  menuiserie: 'Menuiserie',
  main_oeuvre: "Main d'œuvre",
  autre: 'Autre',
};

const categorieTone: Record<Produit['categorie'], BadgeTone> = {
  placo: 'slate',
  isolation: 'amber',
  menuiserie: 'emerald',
  main_oeuvre: 'blue',
  autre: 'slate',
};

export default function CatalogueList() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categorieFilter, setCategorieFilter] = useState<'all' | Produit['categorie']>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProduitData | null>(null);

  const load = () => ipc.invoke<Produit[]>('catalogue:list', true).then(setProduits).catch(() => setProduits([]));

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => produits.filter((p) => {
    if (categorieFilter !== 'all' && p.categorie !== categorieFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.designation.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
  }), [produits, search, categorieFilter]);

  const create = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const edit = (p: Produit) => {
    setEditing({ ...p, actif: p.actif === 1 });
    setFormOpen(true);
  };

  const toggle = async (p: Produit) => {
    await ipc.invoke('catalogue:toggle', p.id);
    load();
  };

  const remove = async (p: Produit) => {
    if (!confirm(`Supprimer "${p.designation}" ?`)) return;
    try {
      await ipc.invoke('catalogue:delete', p.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Catalogue"
        subtitle={`${filtered.length} / ${produits.length} produits & services`}
        actions={
          <Button onClick={create}>
            <Plus className="h-4 w-4" /> Nouveau produit
          </Button>
        }
      />

      <div className="p-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher désignation, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'placo', 'isolation', 'menuiserie', 'main_oeuvre', 'autre'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategorieFilter(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  categorieFilter === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c === 'all' ? 'Tous' : categorieLabel[c]}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Catégorie</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Désignation</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Unité</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Prix HT</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">TVA</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Actif</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <Package className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Aucun produit
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 ${p.actif === 0 ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-3">
                    <Badge tone={categorieTone[p.categorie]}>{categorieLabel[p.categorie]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.designation}</div>
                    {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.unite}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatEuros(p.prix_ht)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.taux_tva}%</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggle(p)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${p.actif === 1 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      aria-label={p.actif === 1 ? 'Désactiver' : 'Activer'}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.actif === 1 ? 'translate-x-4' : 'translate-x-0.5'} translate-y-0.5`} />
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" onClick={() => edit(p)} title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)} title="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <CatalogueForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} editing={editing} />
    </div>
  );
}
