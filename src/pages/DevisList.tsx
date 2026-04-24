import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Pencil, Trash2, Plus, Eye, Send, Check, X, ReceiptText, Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { SendEmailModal } from '@/components/modals/SendEmailModal';
import { ipc } from '@/lib/ipc';
import { formatEuros, formatDate } from '@/lib/utils';

type Statut = 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré';

interface DevisRow {
  id: number;
  numero: string;
  client_id: number;
  client_nom: string;
  date_emission: string;
  date_validite: string;
  statut: Statut;
  objet: string;
  total_ttc: number;
}

const statutTone: Record<Statut, BadgeTone> = {
  brouillon: 'slate',
  envoyé: 'blue',
  accepté: 'emerald',
  refusé: 'red',
  expiré: 'amber',
};

export default function DevisList() {
  const navigate = useNavigate();
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState<'all' | Statut>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sendTarget, setSendTarget] = useState<DevisRow | null>(null);

  const load = () => ipc.invoke<DevisRow[]>('devis:list').then(setDevis).catch(() => setDevis([]));

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => devis.filter((d) => {
    if (statutFilter !== 'all' && d.statut !== statutFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.numero.toLowerCase().includes(q) || d.client_nom.toLowerCase().includes(q) || d.objet.toLowerCase().includes(q);
  }), [devis, search, statutFilter]);

  const openPdf = async (id: number) => {
    setBusyId(id);
    try {
      const { path } = await ipc.invoke<{ path: string }>('devis:pdf', id);
      await ipc.invoke('shell:open-file', path);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const setStatut = async (id: number, statut: Statut) => {
    setBusyId(id);
    try {
      await ipc.invoke('devis:set-statut', id, statut);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (d: DevisRow) => {
    if (!confirm(`Supprimer le devis ${d.numero} ?`)) return;
    try {
      await ipc.invoke('devis:delete', d.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const convertToFacture = async (d: DevisRow) => {
    setBusyId(d.id);
    try {
      const { numero } = await ipc.invoke<{ factureId: number; numero: string }>('devis:to-facture', d.id);
      alert(`Facture créée : ${numero}`);
      navigate('/factures');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const statuts: Array<'all' | Statut> = ['all', 'brouillon', 'envoyé', 'accepté', 'refusé', 'expiré'];

  return (
    <div className="min-h-full">
      <PageHeader
        title="Devis"
        subtitle={`${filtered.length} / ${devis.length} devis`}
        actions={
          <Button onClick={() => navigate('/devis/nouveau')}>
            <Plus className="h-4 w-4" /> Nouveau devis
          </Button>
        }
      />

      <div className="p-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher N°, client, objet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {statuts.map((s) => (
              <button
                key={s}
                onClick={() => setStatutFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statutFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'all' ? 'Tous' : s}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">N°</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Client / Objet</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Émis le</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Validité</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Total TTC</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <FileText className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Aucun devis
                  </td>
                </tr>
              )}
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{d.numero}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{d.client_nom.trim()}</div>
                    <div className="text-xs text-slate-500">{d.objet}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(d.date_emission)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(d.date_validite)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statutTone[d.statut]} className="capitalize">{d.statut}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatEuros(d.total_ttc)}</td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Voir PDF" onClick={() => openPdf(d.id)} disabled={busyId === d.id}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={d.statut === 'brouillon' || d.statut === 'envoyé' ? 'default' : 'ghost'}
                        size="sm"
                        title="Envoyer par email"
                        onClick={() => setSendTarget(d)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {d.statut === 'brouillon' ? 'Envoyer' : d.statut === 'envoyé' ? 'Renvoyer' : ''}
                      </Button>
                      {(d.statut === 'brouillon' || d.statut === 'envoyé') && (
                        <Link to={`/devis/${d.id}`}>
                          <Button variant="ghost" size="icon" title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {d.statut === 'envoyé' && (
                        <>
                          <Button variant="ghost" size="icon" title="Marquer accepté" onClick={() => setStatut(d.id, 'accepté')}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Marquer refusé" onClick={() => setStatut(d.id, 'refusé')}>
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {d.statut === 'accepté' && (
                        <Button variant="ghost" size="icon" title="Transformer en facture" onClick={() => convertToFacture(d)}>
                          <ReceiptText className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {d.statut === 'brouillon' && (
                        <Button variant="ghost" size="icon" title="Supprimer" onClick={() => remove(d)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <SendEmailModal
        open={!!sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={load}
        kind="devis"
        id={sendTarget?.id ?? null}
        numero={sendTarget?.numero ?? ''}
      />
    </div>
  );
}
