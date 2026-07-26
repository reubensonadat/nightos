import { useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { formatGHS } from '../lib/utils';

type SplitMethod = 'even' | 'by_item' | 'custom';

type Props = {
  total: number;
  onSplit: (amounts: number[]) => void;
  onClose: () => void;
};

export function SplitBillModal({ total, onSplit, onClose }: Props) {
  const [method, setMethod] = useState<SplitMethod>('even');
  const [numPeople, setNumPeople] = useState(2);
  const [customAmounts, setCustomAmounts] = useState<number[]>([total]);

  const evenAmounts = useMemo(() => {
    const perPerson = Math.floor((total / numPeople) * 100) / 100;
    const remainder = Math.round((total - perPerson * numPeople) * 100) / 100;
    return Array.from({ length: numPeople }, (_, i) =>
      i === numPeople - 1 ? perPerson + remainder : perPerson,
    );
  }, [total, numPeople]);

  const handleCustomChange = (index: number, value: string) => {
    const newAmounts = [...customAmounts];
    newAmounts[index] = parseFloat(value) || 0;
    setCustomAmounts(newAmounts);
  };

  const addCustomPerson = () => {
    setCustomAmounts([...customAmounts, 0]);
  };

  const removeCustomPerson = (index: number) => {
    if (customAmounts.length <= 1) return;
    setCustomAmounts(customAmounts.filter((_, i) => i !== index));
  };

  const customTotal = useMemo(
    () => customAmounts.reduce((s, a) => s + a, 0),
    [customAmounts],
  );

  const handleConfirm = () => {
    if (method === 'even') onSplit(evenAmounts);
    else if (method === 'by_item') onSplit([total]);
    else onSplit(customAmounts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-licorice/30 backdrop-blur-sm animate-velvet-fade"
      />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-t-[28px] bg-isabelline shadow-[0_-20px_60px_rgba(35,20,12,0.22)] ring-1 ring-white/60 max-h-[85svh] overflow-hidden">
        <div className="flex justify-center pt-3 pb-1">
          <span className="h-1 w-10 rounded-full bg-licorice/15" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="text-[18px] font-bold tracking-tight text-licorice">Split Bill</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/8">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          <p className="mb-4 text-[13px] text-feldgrau">
            Total: <span className="font-bold text-licorice">{formatGHS(total)}</span>
          </p>

          <div className="flex gap-2 mb-6">
            {(['even', 'by_item', 'custom'] as SplitMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-xl py-2.5 text-[11px] font-bold tracking-tight transition-all ${
                  method === m
                    ? 'bg-licorice text-isabelline shadow-sm'
                    : 'bg-white text-feldgrau ring-1 ring-licorice/8'
                }`}
              >
                {m === 'even' ? 'Even' : m === 'by_item' ? 'By Item' : 'Custom'}
              </button>
            ))}
          </div>

          {method === 'even' && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-feldgrau">Number of people</label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNumPeople(Math.max(2, numPeople - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/8"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono text-[18px] font-bold text-licorice">{numPeople}</span>
                <button
                  type="button"
                  onClick={() => setNumPeople(Math.min(20, numPeople + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-licorice text-isabelline"
                >
                  +
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {evenAmounts.map((amount, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-isabelline">
                    <span className="text-[13px] font-medium text-feldgrau">Person {i + 1}</span>
                    <span className="font-mono text-[14px] font-bold text-licorice">{formatGHS(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {method === 'custom' && (
            <div>
              <div className="space-y-2">
                {customAmounts.map((amount, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount || ''}
                      onChange={(e) => handleCustomChange(i, e.target.value)}
                      placeholder="0.00"
                      className="flex-1 rounded-xl bg-white px-4 py-3 text-[13px] text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomPerson(i)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-feldgrau hover:text-dark-red"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCustomPerson}
                className="mt-2 w-full rounded-xl border-2 border-dashed border-licorice/10 py-3 text-[12px] font-bold text-feldgrau hover:text-licorice"
              >
                + Add person
              </button>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-licorice px-4 py-3 text-isabelline">
                <span className="text-[12px] font-bold">Total split</span>
                <span className="font-mono text-[15px] font-bold">{formatGHS(customTotal)}</span>
              </div>
              {Math.abs(customTotal - total) > 0.01 && (
                <p className="mt-1 text-[11px] font-medium text-dark-red">
                  Split total ({formatGHS(customTotal)}) doesn't match bill total ({formatGHS(total)})
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className="mt-6 w-full rounded-full bg-licorice py-3.5 text-[13px] font-bold text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] active:scale-[0.98]"
          >
            Confirm Split
          </button>
        </div>
      </div>
    </div>
  );
}
