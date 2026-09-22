import { KeyIcon } from "@heroicons/react/24/outline";
import bellRingingIcon from "../assets/bell-ringing.svg";

type Props = {
  pin: string;
  tableLabel?: string | null;
  onCallWaiter?: () => void;
  callingWaiter?: boolean;
  waiterCalled?: boolean;
};

export function TablePinBanner({ pin, tableLabel, onCallWaiter, callingWaiter, waiterCalled }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 md:px-8 pt-2.5 pb-0.5">
      <div className="flex items-center justify-between rounded-xl bg-licorice px-3.5 py-2 text-isabelline shadow-sm ring-1 ring-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-khaki/20 text-khaki">
            <KeyIcon className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-khaki">
              {tableLabel ? `${tableLabel} Access PIN` : "Table Access PIN"}
            </p>
            <p className="text-[13px] font-mono font-bold tracking-widest text-white">
              {pin}
            </p>
          </div>
        </div>
        {onCallWaiter && (
          <button
            type="button"
            onClick={onCallWaiter}
            disabled={callingWaiter}
            className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg shadow-sm transition-all active:scale-95 border ${
              waiterCalled
                ? "bg-amber-300 border-amber-400 ring-2 ring-amber-400/50"
                : "bg-white border-white hover:bg-isabelline"
            }`}
            title={waiterCalled ? "Waiter Notified ✓" : "Call Waiter"}
          >
            {callingWaiter ? (
              <span className="text-[14px]">⏳</span>
            ) : (
              <img src={bellRingingIcon} alt="Call Waiter" className="h-5 w-5 object-contain" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
