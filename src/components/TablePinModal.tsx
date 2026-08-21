import { useState, type FormEvent } from "react";
import { LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

type Props = {
  tableLabel?: string | null;
  expectedPin: string;
  onSuccess: () => void;
};

export function TablePinModal({ tableLabel, expectedPin, onSuccess }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim() === expectedPin.trim()) {
      setError(null);
      onSuccess();
    } else {
      setError("Incorrect PIN. Please ask your table host for the 4-digit code.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-licorice/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-isabelline p-6 shadow-2xl ring-1 ring-licorice/10 animate-velvet-scale-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-khaki/20 text-khaki shadow-inner">
          <LockClosedIcon className="h-7 w-7" strokeWidth={2.2} />
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-[17px] font-black tracking-tight text-licorice">
            {tableLabel ? `Join ${tableLabel}` : "Join Table Tab"}
          </h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-feldgrau">
            This table is currently active. Enter the 4-digit Table PIN from your group to start ordering and viewing the bill.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              autoFocus
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(val);
                setError(null);
              }}
              className="w-full text-center font-mono text-2xl font-bold tracking-[0.5em] rounded-2xl bg-white px-4 py-3.5 text-licorice shadow-sm ring-1 ring-licorice/10 focus:outline-none focus:ring-2 focus:ring-khaki"
            />
            {error && (
              <p className="mt-2 text-center text-[11.5px] font-semibold text-rose-600">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-licorice py-3.5 text-[13px] font-bold text-isabelline shadow-lg shadow-licorice/20 transition-all hover:bg-licorice/95 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            <ShieldCheckIcon className="h-4 w-4 text-khaki" strokeWidth={2.2} />
            Unlock Table
          </button>
        </form>
      </div>
    </div>
  );
}
