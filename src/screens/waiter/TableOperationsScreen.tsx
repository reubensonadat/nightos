import { useState, useMemo } from "react";
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckIcon,
    MinusIcon,
    PlusIcon,
    Squares2X2Icon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import { formatGHS } from "../../data/menu";
import type { Table } from "./TablesDashboard";

/* ────────────────────────── Mock tables for transfer/merge ────────────────────────── */

const ALL_TABLES: Table[] = [
    { id: "t01", number: 1, label: "Table 01", status: "available" },
    { id: "t02", number: 2, label: "Table 02", status: "occupied", guests: 2, tabTotal: 245 },
    { id: "t03", number: 3, label: "Table 03", status: "reserved", reservationTime: "7:30 PM" },
    { id: "t04", number: 4, label: "Table 04", status: "occupied", guests: 1, tabTotal: 95 },
    { id: "t05", number: 5, label: "Table 05", status: "available" },
    { id: "t06", number: 6, label: "Table 06", status: "occupied", guests: 6, tabTotal: 480 },
    { id: "t07", number: 7, label: "Table 07", status: "available" },
    { id: "t08", number: 8, label: "Table 08", status: "occupied", guests: 3, tabTotal: 180 },
];

type Op = "transfer" | "merge" | "split";

/* ────────────────────────── Component ────────────────────────── */

type Props = {
    table: Table;
    onBack: () => void;
};

export function TableOperationsScreen({ table, onBack }: Props) {
    const [op, setOp] = useState<Op>("transfer");
    const [selectedDest, setSelectedDest] = useState<string | null>(null);
    const [selectedMerge, setSelectedMerge] = useState<string | null>(null);
    const [guestCount, setGuestCount] = useState(table.guests ?? 2);
    const [confirmFlash, setConfirmFlash] = useState<string | null>(null);

    const billTotal = table.tabTotal ?? 0;
    const perGuest = guestCount > 0 ? billTotal / guestCount : 0;

    // Available tables for transfer (must be available or occupied — not reserved)
    const transferableTables = useMemo(
        () => ALL_TABLES.filter((t) => t.id !== table.id && t.status !== "reserved"),
        [table.id]
    );

    // Occupied tables for merge
    const mergeableTables = useMemo(
        () => ALL_TABLES.filter((t) => t.id !== table.id && t.status === "occupied"),
        [table.id]
    );

    const handleConfirm = () => {
        if (op === "transfer" && selectedDest) {
            const dest = ALL_TABLES.find((t) => t.id === selectedDest);
            setConfirmFlash(`Transferred to Table ${String(dest?.number).padStart(2, "0")}`);
        } else if (op === "merge" && selectedMerge) {
            const dest = ALL_TABLES.find((t) => t.id === selectedMerge);
            setConfirmFlash(`Merged with Table ${String(dest?.number).padStart(2, "0")}`);
        } else if (op === "split") {
            setConfirmFlash(`Bill split ${guestCount} ways`);
        }
        window.setTimeout(() => setConfirmFlash(null), 2500);
    };

    const canConfirm =
        (op === "transfer" && selectedDest !== null) ||
        (op === "merge" && selectedMerge !== null) ||
        op === "split";

    return (
        <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice antialiased flex flex-col">
            {/* ═══════════════════════════════════════════════════════════
                LIGHT EDITORIAL HEADER
              ═══════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-30 bg-isabelline/95 backdrop-blur-xl border-b border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-licorice shadow-sm ring-1 ring-licorice/8 transition-colors hover:bg-isabelline active:scale-95"
                    >
                        <ArrowLeftIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>

                    <div className="flex flex-col items-center leading-tight">
                        <span className="text-[13px] font-bold tracking-tight text-licorice">
                            Table {String(table.number).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-feldgrau">
                            Table Operations
                        </span>
                    </div>

                    <div className="w-9" />
                </div>

                {/* Op tabs */}
                <nav className="mx-auto w-full max-w-3xl px-5 md:px-8 pb-3">
                    <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-licorice/8">
                        <button
                            type="button"
                            onClick={() => setOp("transfer")}
                            className={`flex-1 rounded-full py-2 text-[11px] font-bold tracking-tight transition-all duration-200 ${op === "transfer"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:text-licorice"
                                }`}
                        >
                            Transfer
                        </button>
                        <button
                            type="button"
                            onClick={() => setOp("merge")}
                            className={`flex-1 rounded-full py-2 text-[11px] font-bold tracking-tight transition-all duration-200 ${op === "merge"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:text-licorice"
                                }`}
                        >
                            Merge
                        </button>
                        <button
                            type="button"
                            onClick={() => setOp("split")}
                            className={`flex-1 rounded-full py-2 text-[11px] font-bold tracking-tight transition-all duration-200 ${op === "split"
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                : "text-feldgrau hover:text-licorice"
                                }`}
                        >
                            Split
                        </button>
                    </div>
                </nav>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT
              ═══════════════════════════════════════════════════════════ */}
            <section className="mx-auto w-full max-w-3xl flex-1 px-5 md:px-8 pt-5 pb-[100px]">
                {/* ── TRANSFER ── */}
                {op === "transfer" && (
                    <div className="animate-velvet-fade">
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <ArrowPathIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Transfer Tab
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                                Move the entire open tab (<strong className="text-licorice">{formatGHS(billTotal)}</strong>) from Table {String(table.number).padStart(2, "0")} to another table.
                            </p>
                        </div>

                        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                            Select destination
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {transferableTables.map((t) => {
                                const isSelected = selectedDest === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setSelectedDest(t.id)}
                                        className={`
                                            flex flex-col items-center rounded-xl py-3
                                            transition-all duration-150 active:scale-95
                                            ${isSelected
                                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                                : "bg-white text-licorice ring-1 ring-isabelline hover:ring-khaki/30"
                                            }
                                        `}
                                    >
                                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">
                                            Table
                                        </span>
                                        <span className="mt-0.5 font-serif text-[20px] font-black leading-none tracking-[-0.04em]">
                                            {String(t.number).padStart(2, "0")}
                                        </span>
                                        <span className={`mt-1 text-[8px] font-bold uppercase tracking-wider ${isSelected ? "opacity-80" : "text-feldgrau"}`}>
                                            {t.status === "occupied" ? "Open" : "Free"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── MERGE ── */}
                {op === "merge" && (
                    <div className="animate-velvet-fade">
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <Squares2X2Icon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Merge Tables
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                                Combine Table {String(table.number).padStart(2, "0")} with another occupied table. Tabs and guests will be joined.
                            </p>
                        </div>

                        {mergeableTables.length === 0 ? (
                            <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-isabelline">
                                <p className="text-[12px] font-medium tracking-tight text-feldgrau">
                                    No other occupied tables to merge with.
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                                    Merge with
                                </p>
                                <div className="flex flex-col gap-2">
                                    {mergeableTables.map((t) => {
                                        const isSelected = selectedMerge === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setSelectedMerge(t.id)}
                                                className={`
                                                    flex items-center justify-between rounded-xl px-4 py-3
                                                    transition-all duration-150 active:scale-[0.98]
                                                    ${isSelected
                                                        ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.18)]"
                                                        : "bg-white text-licorice ring-1 ring-isabelline hover:ring-khaki/30"
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-serif text-[20px] font-black leading-none tracking-[-0.04em]">
                                                        {String(t.number).padStart(2, "0")}
                                                    </span>
                                                    <div className="text-left">
                                                        <p className={`text-[11px] font-bold tracking-tight ${isSelected ? "" : "text-licorice"}`}>
                                                            Table {String(t.number).padStart(2, "0")}
                                                        </p>
                                                        <p className={`text-[10px] font-semibold ${isSelected ? "opacity-80" : "text-feldgrau"}`}>
                                                            {t.guests} guests · {formatGHS(t.tabTotal ?? 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isSelected && <CheckIcon className="h-4 w-4" strokeWidth={2.5} />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedMerge && (
                                    <div className="mt-4 rounded-xl bg-khaki/12 px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-khaki">
                                            Combined Tab
                                        </p>
                                        <p className="mt-0.5 font-mono text-[16px] font-bold tabular-nums text-licorice">
                                            {formatGHS(billTotal + (ALL_TABLES.find((t) => t.id === selectedMerge)?.tabTotal ?? 0))}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── SPLIT ── */}
                {op === "split" && (
                    <div className="animate-velvet-fade">
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                            <div className="flex items-center gap-2">
                                <UserGroupIcon className="h-4 w-4 text-khaki" strokeWidth={2} />
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Split the Bill
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-[1.5] tracking-tight text-feldgrau">
                                Divide the current tab evenly across all guests at the table.
                            </p>
                        </div>

                        {/* Bill total card */}
                        <div className="mb-4 rounded-2xl bg-licorice p-5 text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-isabelline/60">
                                Total Bill
                            </p>
                            <p className="mt-1 font-mono text-[28px] font-black tabular-nums">
                                {formatGHS(billTotal)}
                            </p>
                        </div>

                        {/* Guest count */}
                        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-bold tracking-tight text-licorice">
                                    Number of guests
                                </span>
                                <div className="flex items-center gap-2 rounded-full bg-isabelline p-1">
                                    <button
                                        type="button"
                                        onClick={() => setGuestCount((g) => Math.max(2, g - 1))}
                                        disabled={guestCount <= 2}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-licorice shadow-sm transition-all active:scale-90 disabled:opacity-30"
                                    >
                                        <MinusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </button>
                                    <span className="w-8 text-center font-mono text-[14px] font-bold tabular-nums text-licorice">
                                        {guestCount}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setGuestCount((g) => Math.min(12, g + 1))}
                                        disabled={guestCount >= 12}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-licorice text-isabelline transition-all active:scale-90 disabled:opacity-30"
                                    >
                                        <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Per guest amount */}
                        <div className="rounded-2xl bg-khaki/12 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                Per Guest
                            </p>
                            <p className="mt-1 font-mono text-[24px] font-black tabular-nums text-licorice">
                                {formatGHS(perGuest)}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold tracking-tight text-feldgrau">
                                {guestCount} guests · even split
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                BOTTOM ACTION BAR
              ═══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-x-0 bottom-0 z-40 bg-isabelline/95 backdrop-blur-xl border-t border-licorice/8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-5 md:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!canConfirm || !!confirmFlash}
                        className={`
                            inline-flex items-center justify-center gap-1.5
                            rounded-full px-5 py-3
                            text-[12px] font-bold tracking-tight
                            transition-all duration-200 active:scale-[0.98]
                            ${confirmFlash
                                ? "bg-khaki/20 text-khaki"
                                : "bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] hover:bg-licorice/95 disabled:opacity-40 disabled:shadow-none"
                            }
                        `}
                    >
                        {confirmFlash ? (
                            <>
                                <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                                {confirmFlash}
                            </>
                        ) : (
                            <>Confirm</>
                        )}
                    </button>
                </div>
            </div>
        </main>
    );
}
