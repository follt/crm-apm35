import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Receipt, Pencil, Trash2, Plus, Eye, Send, Banknote, Coins, Bell, Ban, Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { PaiementModal } from '@/components/modals/PaiementModal';
import { SendEmailModal } from '@/components/modals/SendEmailModal';
import { ipc } from '@/lib/ipc';
import { formatEuros, formatDate, cn } from '@/lib/utils';

type Statut = 'brouillon' | 'envoyée' | 'payée' | 'partiellement_payée' | 'en_retard' | 'annulée';

interface FactureRow {
  id: number;
  numero: string;
  client_nom: string;
  date_emission: string;
  date_echeance: string;
  statut: Statut;
  objet: string;
  total_ttc: number;
  montant_paye: number;
}

const statutTone: Record<Statut, BadgeTone> = {
  brouillon: 'slate',
  envoyée: 'blue',
  payée: 'emerald',
  partiellement_payée: 'amber',
  en_retard: 'red',
  annulée: 'slate',
};

const statutLabel: Record<Statut, string> = {
  brouillon: 'Brouillon',
  envoyée: 'Envoyée',
  payée: 'Payée',
  partiellement_payée: 'Partielle',
  en_retard: 'En retard',
  annulée: 'Annulée',
};

export default function FacturesList() {
  const navigate = useNavigate();
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState<'all' | Statut>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [paiementFacture, setPaiementFacture] = useState<FactureRow | null>(null);
  const [paiementMode, setPaiementMode] = useState<'full' | 'partial'>('full');
  const [sendTarget, setSendTarget] = useState<FactureRow | null>(null);

  const load = () => ipc.invoke<FactureRow[]>('factures:list').then(setFactures).catch(() => setFactures([]));

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => factures.filter((f) => {
    if (statutFilter !== 'all' && f.statut !== statutFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return f.numero.toLowerCase().includes(q) || f.client_nom.toLowerCase().includes(q) || f.objet.toLowerCase().includes(q);
  }), [factures, search, statutFilter]);

  const openPdf = async (id: number) => {
    setBusyId(id);
    try {
      const { path } = await ipc.invoke<{ path: string }>('factures:pdf', id);
      await ipc.invoke('shell:open-file', path);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const sendRelance = async (f: FactureRow) => {
    if (!confirm(`Envoyer une relance pour la facture ${f.numero} ?`)) return;
    setBusyId(f.id);
    try {
      const result = await ipc.invoke<{ niveau: number; to: string }>('factures:send-relance', f.id);
      alert(`Relance niveau ${result.niveau} envoyée à ${result.to}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (f: FactureRow) => {
    if (!confirm(`Annuler la facture ${f.numero} ?`)) return;
    await ipc.invoke('factures:set-statut', f.id, 'annulée');
    load();
  };

  const remove = async (f: FactureRow) => {
    if (!confirm(`Supprimer la facture ${f.numero} ?`)) return;
    try {
      await ipc.invoke('factures:delete', f.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const openPaiement = (f: FactureRow, mode: 'full' | 'partial') => {
    setPaiementFacture(f);
    setPaiementMode(mode);
  };

  const statuts: Array<'all' | Statut> = ['all', 'brouillon', 'envoyée', 'payée', 'partiellement_payée', 'en_retard', 'annulée'];

  return (
    <div className="min-h-full">
      <PageHeader
        title="Factures"
        subtitle={`${filtered.length} / ${factures.length} factures`}
        actions={
          <Button onClick={() => navigate('/factures/nouveau')}>
            <Plus className="h-4 w-4" /> Nouvelle facture
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
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statutFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'all' ? 'Tous' : statutLabel[s as Statut]}
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
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Émise le</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Échéance</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Total TTC</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Reste dû</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                    <Receipt className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Aucune facture
                  </td>
                </tr>
              )}
              {filtered.map((f) => {
                const reste = f.total_ttc - f.montant_paye;
                return (
                  <tr key={f.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{f.numero}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{f.client_nom.trim()}</div>
                      <div className="text-xs text-slate-500">{f.objet}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(f.date_emission)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(f.date_echeance)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statutTone[f.statut]}>{statutLabel[f.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatEuros(f.total_ttc)}</td>
                    <td className={cn('px-4 py-3 text-right', reste > 0 ? 'font-semibold text-red-700' : 'text-slate-400')}>
                      {formatEuros(reste)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" title="Voir PDF" onClick={() => openPdf(f.id)} disabled={busyId === f.id}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={f.statut === 'brouillon' || f.statut === 'envoyée' ? 'default' : 'ghost'}
                          size="sm"
                          title="Envoyer par email"
                          onClick={() => setSendTarget(f)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {f.statut === 'brouillon' ? 'Envoyer' : f.statut === 'envoyée' ? 'Renvoyer' : ''}
                        </Button>
                        {f.statut === 'brouillon' && (
                          <Link to={`/factures/${f.id}`}>
                            <Button variant="ghost" size="icon" title="Modifier">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {f.statut !== 'payée' && f.statut !== 'annulée' && (
                          <>
                            <Button variant="ghost" size="icon" title="Marquer payée" onClick={() => openPaiement(f, 'full')}>
                              <Banknote className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Paiement partiel" onClick={() => openPaiement(f, 'partial')}>
                              <Coins className="h-4 w-4 text-amber-600" />
                            </Button>
                          </>
                        )}
                        {(f.statut === 'envoyée' || f.statut === 'en_retard' || f.statut === 'partiellement_payée') && (
                          <Button variant="ghost" size="icon" title="Relancer" onClick={() => sendRelance(f)} disabled={busyId === f.id}>
                            <Bell className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                        {f.statut !== 'payée' && f.statut !== 'annulée' && f.statut !== 'brouillon' && (
                          <Button variant="ghost" size="icon" title="Annuler" onClick={() => cancel(f)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {f.statut === 'brouillon' && (
                          <Button variant="ghost" size="icon" title="Supprimer" onClick={() => remove(f)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <PaiementModal
        open={!!paiementFacture}
        onClose={() => setPaiementFacture(null)}
        onDone={load}
        facture={paiementFacture}
        mode={paiementMode}
      />

      <SendEmailModal
        open={!!sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={load}
        kind="factures"
        id={sendTarget?.id ?? null}
        numero={sendTarget?.numero ?? ''}
      />
    </div>
  );
}
