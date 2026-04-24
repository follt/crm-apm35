import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ipc } from '@/lib/ipc';
import { formatEuros } from '@/lib/utils';

interface FactureLite {
  id: number;
  numero: string;
  total_ttc: number;
  montant_paye: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  facture: FactureLite | null;
  mode: 'full' | 'partial';
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function PaiementModal({ open, onClose, onDone, facture, mode }: Props) {
  const [date, setDate] = useState(todayISO());
  const [modePaiement, setModePaiement] = useState('Virement');
  const [amount, setAmount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facture) return;
    setDate(todayISO());
    setModePaiement('Virement');
    setAmount(mode === 'partial' ? Math.max(0, facture.total_ttc - facture.montant_paye) : facture.total_ttc);
    setError(null);
  }, [facture, mode, open]);

  if (!facture) return null;

  const resteDu = facture.total_ttc - facture.montant_paye;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'full') {
        await ipc.invoke('factures:mark-paid', facture.id, modePaiement, date);
      } else {
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant doit être un nombre > 0');
        if (amount > resteDu + 0.001) throw new Error('Montant > reste dû');
        await ipc.invoke('factures:partial-pay', facture.id, amount, modePaiement, date);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'full' ? `Paiement intégral — ${facture.numero}` : `Paiement partiel — ${facture.numero}`}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <div className="flex justify-between"><span>Total TTC</span><span className="font-medium">{formatEuros(facture.total_ttc)}</span></div>
          <div className="flex justify-between"><span>Déjà payé</span><span>{formatEuros(facture.montant_paye)}</span></div>
          <div className="mt-1 flex justify-between border-t pt-1"><span>Reste dû</span><span className="font-semibold">{formatEuros(resteDu)}</span></div>
        </div>

        <div className="space-y-1.5">
          <Label>Date de paiement *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Mode de paiement *</Label>
          <Select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
            <option value="Virement">Virement</option>
            <option value="Chèque">Chèque</option>
            <option value="Espèces">Espèces</option>
            <option value="CB">CB</option>
          </Select>
        </div>

        {mode === 'partial' && (
          <div className="space-y-1.5">
            <Label>Montant du paiement *</Label>
            <Input type="number" step="0.01" min="0.01" max={resteDu} value={amount} onChange={(e) => {
              const n = Number(e.target.value);
              setAmount(Number.isFinite(n) && n >= 0 ? n : 0);
            }} required />
          </div>
        )}

        {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Valider'}</Button>
        </div>
      </form>
    </Modal>
  );
}
