import { formatGHS } from "../data/menu";

type Props = {
  venueName?: string | null;
  tableLabel?: string | null;
  depositAmount: number;
  remainingCredit?: number;
  amountDue?: number;
  netBalance?: number;
  totalSpend?: number;
  onClose: () => void;
};

/**
 * Clean, minimal welcome modal shown when opening/joining a table with a prepaid deposit.
 * Accurately displays positive available credit, zero balance, or negative balance (amount due over deposit).
 */
export function DepositWelcomeModal({
  venueName,
  tableLabel,
  depositAmount,
  remainingCredit: propRemainingCredit,
  amountDue: propAmountDue,
  netBalance: propNetBalance,
  totalSpend: propTotalSpend,
  onClose,
}: Props) {
  // Determine accurate balance numbers
  const initialDeposit = Math.max(0, depositAmount || 0);

  // Compute remaining credit & amount due if not explicitly provided
  let remainingCredit =
    propRemainingCredit !== undefined
      ? Math.max(0, propRemainingCredit)
      : propTotalSpend !== undefined
      ? Math.max(0, Math.round((initialDeposit - propTotalSpend) * 100) / 100)
      : initialDeposit;

  let amountDue =
    propAmountDue !== undefined
      ? Math.max(0, propAmountDue)
      : propTotalSpend !== undefined
      ? Math.max(0, Math.round((propTotalSpend - initialDeposit) * 100) / 100)
      : 0;

  let netBalance =
    propNetBalance !== undefined
      ? propNetBalance
      : amountDue > 0
      ? -amountDue
      : remainingCredit;

  // Derive total spend if not explicitly provided
  const totalSpend =
    propTotalSpend !== undefined
      ? propTotalSpend
      : netBalance < 0
      ? Math.round((initialDeposit + Math.abs(netBalance)) * 100) / 100
      : Math.round((initialDeposit - remainingCredit) * 100) / 100;

  const isNegative = netBalance < 0 || amountDue > 0;
  const isFullySpent = !isNegative && remainingCredit === 0 && initialDeposit > 0;
  const isPartiallySpent = !isNegative && remainingCredit < initialDeposit && totalSpend > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-licorice/70 backdrop-blur-sm px-0 md:px-4">
      <div
        className="w-full max-w-md rounded-t-[2rem] md:rounded-2xl bg-isabelline p-6 md:p-8 shadow-[0_-24px_60px_rgba(35,20,12,0.4)] md:shadow-2xl ring-1 ring-licorice/10 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle for mobile */}
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-licorice/15 md:hidden" />

        {/* Header Badges & Title */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {tableLabel && (
              <span className="inline-flex items-center rounded-md bg-licorice/5 px-2 py-0.5 text-[11px] font-bold text-licorice/80 ring-1 ring-licorice/10">
                {tableLabel}
              </span>
            )}
            {isNegative ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                Negative Balance
              </span>
            ) : isFullySpent ? (
              <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-500/20">
                Deposit Exhausted
              </span>
            ) : null}
          </div>

          <h2 className="font-display text-[22px] font-black tracking-[-0.03em] text-licorice">
            {isNegative
              ? "Outstanding Table Balance"
              : isFullySpent
              ? "Prepaid Deposit Fully Used"
              : "Prepaid Table Credit Active"}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-feldgrau">
            {venueName ? `${venueName} · ` : ""}
            {isNegative ? (
              <>Orders have exceeded the initial {formatGHS(initialDeposit)} prepaid deposit.</>
            ) : isFullySpent ? (
              <>The initial {formatGHS(initialDeposit)} deposit has been fully utilized.</>
            ) : isPartiallySpent ? (
              "Your table has active prepaid credit remaining to spend on drinks and food."
            ) : (
              "Your upfront deposit is ready to spend on drinks and food."
            )}
          </p>
        </div>

        {/* Hero Balance Card */}
        <div
          className={`mt-5 overflow-hidden rounded-2xl p-5 text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.25)] ring-1 ${
            isNegative
              ? "bg-licorice ring-rose-500/40 border border-rose-500/20 shadow-[0_12px_32px_rgba(225,29,72,0.18)]"
              : isFullySpent
              ? "bg-licorice ring-amber-500/30"
              : "bg-licorice ring-khaki/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                isNegative ? "text-rose-400" : isFullySpent ? "text-amber-400" : "text-khaki"
              }`}
            >
              {isNegative
                ? "Negative Balance (Due)"
                : isFullySpent
                ? "Remaining Credit"
                : isPartiallySpent
                ? "Available Remaining Credit"
                : "Available Credit"}
            </span>
            {isNegative && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full ring-1 ring-rose-500/30">
                Over Deposit
              </span>
            )}
          </div>

          <div
            className={`mt-2 font-mono text-[32px] font-black tracking-tight ${
              isNegative ? "text-rose-400" : isFullySpent ? "text-isabelline/70" : "text-isabelline"
            }`}
          >
            {isNegative ? (
              <span className="inline-flex items-baseline gap-1">
                <span>-</span>
                {formatGHS(amountDue)}
              </span>
            ) : (
              formatGHS(remainingCredit)
            )}
          </div>

          {/* Ledger Breakdown Details */}
          {(isPartiallySpent || isNegative || isFullySpent) && (
            <div className="mt-4 pt-3.5 border-t border-isabelline/10 grid grid-cols-2 gap-4 text-[11px]">
              <div>
                <span className="block text-isabelline/50 text-[9.5px] uppercase tracking-wider font-semibold">
                  Initial Deposit
                </span>
                <span className="font-mono font-bold text-isabelline/90 text-[13px]">
                  {formatGHS(initialDeposit)}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-isabelline/50 text-[9.5px] uppercase tracking-wider font-semibold">
                  Total Spent
                </span>
                <span className="font-mono font-bold text-isabelline/90 text-[13px]">
                  {formatGHS(totalSpend)}
                </span>
              </div>
            </div>
          )}

          {!isPartiallySpent && !isNegative && !isFullySpent && (
            <p className="mt-1 text-[11px] text-isabelline/60">
              Automatically deducted as items are ordered
            </p>
          )}
        </div>

        {/* Explanatory note */}
        <p className="mt-4 text-[12px] leading-relaxed text-feldgrau">
          {isNegative ? (
            <>
              Orders have exceeded the prepaid deposit credit. Any extra orders will be added to the shared tab to settle under <strong className="font-bold text-licorice">Tab</strong>.
            </>
          ) : isFullySpent ? (
            <>
              The prepaid deposit is fully used. Additional food and drink orders will be added to the shared post-pay tab under <strong className="font-bold text-licorice">Tab</strong>.
            </>
          ) : (
            <>
              Orders deduct directly from your credit. You can track your remaining balance anytime under <strong className="font-bold text-licorice">Tab</strong>.
            </>
          )}
        </p>

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className={`flex w-full items-center justify-center rounded-full py-3.5 text-[13px] font-bold shadow-[0_4px_16px_rgba(35,20,12,0.25)] transition-all active:scale-[0.98] ${
              isNegative
                ? "bg-licorice text-isabelline hover:bg-licorice/95 ring-1 ring-rose-500/30"
                : "bg-licorice text-khaki hover:bg-licorice/95"
            }`}
          >
            {isNegative ? "View Menu & Tab" : "Start Ordering"}
          </button>
        </div>
      </div>
    </div>
  );
}
