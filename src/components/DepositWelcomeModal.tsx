import { formatGHS } from "../data/menu";

type Props = {
  venueName?: string | null;
  tableLabel?: string | null;
  depositAmount: number;
  onClose: () => void;
};

/**
 * Clean, minimal welcome modal shown when opening a VIP table with prepaid credit.
 */
export function DepositWelcomeModal({ venueName, depositAmount, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-licorice/70 backdrop-blur-sm px-0 md:px-4">
      <div
        className="w-full max-w-md rounded-t-[2rem] md:rounded-2xl bg-isabelline p-6 md:p-8 shadow-[0_-24px_60px_rgba(35,20,12,0.4)] md:shadow-2xl ring-1 ring-licorice/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle for mobile */}
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-licorice/15 md:hidden" />

        {/* Title */}
        <div>
          <h2 className="font-display text-[22px] font-black tracking-[-0.03em] text-licorice">
            Prepaid Table Credit Active
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-feldgrau">
            {venueName ? `${venueName} · ` : ""}Your upfront deposit is ready to spend on drinks and food.
          </p>
        </div>

        {/* Credit Card */}
        <div className="mt-5 overflow-hidden rounded-2xl bg-licorice p-5 text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.25)] ring-1 ring-khaki/30">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-khaki">
            Available Credit
          </span>
          <div className="mt-2 font-mono text-[32px] font-black tracking-tight text-isabelline">
            {formatGHS(depositAmount)}
          </div>
          <p className="mt-1 text-[11px] text-isabelline/60">
            Automatically deducted as items are ordered
          </p>
        </div>

        {/* Concise note */}
        <p className="mt-4 text-[12px] leading-relaxed text-feldgrau">
          Orders deduct directly from your credit. You can track your remaining balance anytime under <strong className="font-bold text-licorice">Tab</strong>.
        </p>

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-full bg-licorice py-3.5 text-[13px] font-bold text-khaki shadow-[0_4px_16px_rgba(35,20,12,0.25)] transition-all hover:bg-licorice/95 active:scale-[0.98]"
          >
            Start Ordering
          </button>
        </div>
      </div>
    </div>
  );
}
