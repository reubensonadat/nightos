import { useState } from "react";
import { MinusIcon, PlusIcon, UserGroupIcon } from "@heroicons/react/24/outline";

type Props = {
    venueName: string;
    tableLabel?: string | null;
    initialSize?: number;
    saving?: boolean;
    onConfirm: (partySize: number, guestName?: string) => Promise<void>;
};

/**
 * First screen after a QR scan: "How many of you?" — captures the party
 * size (feeds waiter load balancing + guest counts) and an optional name,
 * then drops the guest straight into the menu.
 */
export function PartyPrompt({ venueName, tableLabel, initialSize = 1, saving = false, onConfirm }: Props) {
    const [size, setSize] = useState(initialSize);
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);

    const handleStart = async () => {
        if (busy || saving) return;
        setBusy(true);
        try {
            await onConfirm(size, name.trim() || undefined);
        } finally {
            setBusy(false);
        }
    };

    const decrement = () => setSize((s) => Math.max(1, s - 1));
    const increment = () => setSize((s) => Math.min(24, s + 1));

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-licorice/60 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-md rounded-t-[2rem] bg-isabelline px-6 pt-8 pb-[max(env(safe-area-inset-bottom),24px)] shadow-[0_-24px_60px_rgba(35,20,12,0.35)]">
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-licorice/15" />

                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-khaki">
                            {tableLabel ? `Table ${tableLabel}` : "Welcome"}
                        </p>
                        <h1 className="mt-1 font-display text-[24px] font-black tracking-[-0.03em] text-licorice">
                            How many of you?
                        </h1>
                        <p className="mt-1 text-[12px] leading-snug tracking-tight text-feldgrau">
                            {venueName} · one quick question before the menu
                        </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-licorice text-isabelline">
                        <UserGroupIcon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                </div>

                {/* Party size stepper */}
                <div className="mt-6 flex items-center justify-center gap-6">
                    <button
                        type="button"
                        onClick={decrement}
                        aria-label="Fewer guests"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/10 transition-all hover:bg-isabelline active:scale-90 disabled:opacity-40"
                        disabled={size <= 1}
                    >
                        <MinusIcon className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <div className="w-24 text-center">
                        <span className="font-mono text-[44px] font-black tabular-nums leading-none text-licorice">
                            {size}
                        </span>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            {size === 1 ? "guest" : "guests"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={increment}
                        aria-label="More guests"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/10 transition-all hover:bg-isabelline active:scale-90"
                    >
                        <PlusIcon className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                </div>

                {/* Optional name */}
                <div className="mt-6">
                    <label htmlFor="guest-name" className="text-[9px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                        Your name (optional)
                    </label>
                    <input
                        id="guest-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Kojo"
                        maxLength={40}
                        className="mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold tracking-tight text-licorice placeholder:text-feldgrau/40 ring-1 ring-licorice/8 outline-none transition-shadow focus:ring-2 focus:ring-khaki"
                    />
                </div>

                <button
                    type="button"
                    onClick={handleStart}
                    disabled={busy || saving}
                    className="mt-6 w-full rounded-full bg-licorice py-4 text-[13px] font-bold tracking-tight text-isabelline shadow-[0_12px_30px_rgba(35,20,12,0.25)] transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-60"
                >
                    {busy || saving ? "Setting your table…" : `Start Ordering for ${size}`}
                </button>

                <p className="mt-3 text-center text-[10px] font-medium tracking-tight text-feldgrau/70">
                    Your waiter is assigned by current table load — the bigger your party, the lighter their load.
                </p>
            </div>
        </div>
    );
}
