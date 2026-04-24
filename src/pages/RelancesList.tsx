import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { ipc } from '@/lib/ipc';
import { formatEuros, formatDate } from '@/lib/utils';

interface FactureRow {
  id: number;
  numero: string;
  client_nom: string;
  date_echeance: string;
  statut: 'brouillon' | 'envoyée' | 'payée' | 'partiellement_payée' | 'en_retard' | 'annulée';
  total_ttc: number;
  montant_paye: number;
}

interface RelanceHistory {
  facture_id: number;
  max_niveau: number;
  last_envoi: string | null;
}

export default function RelancesList() {
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [history, setHistory] = useState<Record<number, RelanceHistory>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const all = await ipc.invoke<FactureRow[]>('factures:list');
    const pending = all.filter((f) => f.statut === 'en_retard' || (f.statut === 'envoyée' && new Date(f.date_echeance) < new Date()) || f.statut === 'partiellement_payée');
    setFactures(pending);

    const entries = await Promise.all(
      pending.map(async (f) => {
        try {
          const { relances } = await ipc.invoke<{ relances: Array<{ niveau: number; date_envoi: string }> }>('factures:get', f.id);
          const max = relances.reduce((m, r) => Math.max(m, r.niveau), 0);
          const last = relances[0]?.date_envoi ?? null;
          return [f.id, { facture_id: f.id, max_niveau: max, last_envoi: last }] as const;
        } catch {
          return [f.id, { facture_id: f.id, max_niveau: 0, last_envoi: null }] as const;
        }
      }),
    );
    setHistory(Object.fromEntries(entries));
  };

  useEffect(() => {
    load();
  }, []);

  const sendRelance = async (f: FactureRow) => {
    if (!confirm(`Envoyer une relance pour la facture ${f.numero} ?`)) return;
    setBusy(f.id);
    try {
      const result = await ipc.invoke<{ niveau: number; to: string }>('factures:send-relance', f.id);
      alert(`Relance niveau ${result.niveau} envoyée à ${result.to}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const joursRetard = (echeance: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(echeance).getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-full">
      <PageHeader
        title="Relances"
        subtitle={`${factures.length} facture${factures.length > 1 ? 's' : ''} à traiter`}
      />

      <div className="p-8">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">N° Facture</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Client</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Échéance</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Retard</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Montant dû</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Dernière relance</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {factures.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <Bell className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Aucune facture à relancer
                  </td>
                </tr>
              )}
              {factures.map((f) => {
                const retard = joursRetard(f.date_echeance);
                const du = f.total_ttc - f.montant_paye;
                const h = history[f.id];
                const prochainNiveau = Math.min(3, (h?.max_niveau ?? 0) + 1);
                return (
                  <tr key={f.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{f.numero}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{f.client_nom.trim()}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(f.date_echeance)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={retard > 30 ? 'red' : 'amber'}>{retard} jours</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">{formatEuros(du)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {h?.last_envoi ? <>Niveau {h.max_niveau} · {formatDate(h.last_envoi)}</> : <span>Jamais</span>}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => sendRelance(f)} disabled={busy === f.id}>
                          <Send className="h-4 w-4" />
                          Relance N°{prochainNiveau}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
