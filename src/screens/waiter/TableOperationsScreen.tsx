import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckIcon,
    MinusIcon,
    PlusIcon,
    Squares2X2Icon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { formatGHS } from "../../data/menu";
import { db } from "../../lib/api";
import { useRealtime } from "../../hooks/useRealtime";
import type { Table } from "./TablesDashboard";

/* ────────────────────────── Types ────────────────────────── */

type Op = "transfer" | "merge" | "split" | "close";

type OpenBill = {
    id: string;
    table_id: string;
    guest_count: number;
    total: number;
    amount_paid: number;
    status: string;
};

/* ────────────────────────── Component ────────────────────────── */



export function TableOperationsScreen() {
    const { table, staffId, venueId } = useOutletContext<{ table: Table; venueId: string; staffId: string }>();
    const navigate = useNavigate();
    const onBack = () => navigate(`/waiter/table/${table.id}`);
    const [op, setOp] = useState<Op>("transfer");
    const [tables, setTables] = useState<Table[]>([]);
    const [openBills, setOpenBills] = useState<OpenBill[]>([]);
    const [bill, setBill] = useState<OpenBill | null>(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<Op | null>(null);
    const [selectedDest, setSelectedDest] = useState<string | null>(null);
    const [selectedMerge, setSelectedMerge] = useState<string | null>(null);
    const [ways, setWays] = useState(2);
    const [confirmClose, setConfirmClose] = useState(false);
    const reloadTimer = useRef<number | null>(null);

    const fetchData = useCallback(async () => {
        if (!venueId) return;
        try {
            const [tablesResult, billsResult, currentBill] = await Promise.all([
                db.tablesByVenue(venueId),
                db.billsByVenue(venueId),
                db.openBillForTable(table.id),
            ]);
            if (tablesResult.error) throw tablesResult.error;
            setTables(
                (tablesResult.data ?? []).map((t) => ({
                    id: t.id,
                    number: t.table_number,
                    label: t.table_label,
                    status: "available" as const,
                })),
            );
            setOpenBills(billsResult.data ?? []);
            setBill(currentBill.data ?? null);
        } catch {
            toast.error("Could not load table data.");
        } finally {
            setLoading(false);
        }
    }, [venueId, table.id]);

    const fetchDataRef = useRef(fetchData);
    fetchDataRef.current = fetchData;

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Live refresh when any bill changes on this floor.
    useRealtime({
        table: "bills",
        filter: `venue_id=eq.${venueId}`,
        onInsert: () => {
            if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
            reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
        },
        onUpdate: () => {
            if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
            reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
        },
        onDelete: () => {
            if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
            reloadTimer.current = window.setTimeout(() => fetchDataRef.current(), 500);
        },
    });

    useEffect(() => () => {
        if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    }, []);

    // Tables with no open bill are valid transfer destinations.
    const occupiedTableIds = useMemo(() => new Set(openBills.map((b) => b.table_id)), [openBills]);
    const transferableTables = useMemo(
        () => tables.filter((t) => t.id !== table.id && !occupiedTableIds.has(t.id)),
        [tables, table.id, occupiedTableIds],
    );

    // Other occupied tables are merge destinations.
    const mergeableTables = useMemo(
        () =>
            tables
                .filter((t) => occupiedTableIds.has(t.id) && t.id !== table.id)
                .map((t) => ({
                    table: t,
                    bill: openBills.find((b) => b.table_id === t.id),
                })),
        [tables, occupiedTableIds, openBills],
    );

    const billTotal = bill?.total ?? 0;
    const perGuest = ways > 0 ? billTotal / ways : 0;

    const handleConfirm = async () => {
        if (!bill) {
            toast.error("This table has no open bill.");
            return;
        }
        if (op === "transfer" && selectedDest) {
            setWorking("transfer");
            const { data, error } = await db.transferBill(bill.id, selectedDest, staffId);
            setWorking(null);
            if (error || !data.ok) {
                const code = (data as { error?: string }).error ?? "failed";
                toast.error(code === "table_occupied"
                    ? "That table already has an open tab."
                    : code === "bill_not_open"
                        ? "This tab is no longer open."
                        : "Transfer failed — try again.");
                return;
            }
            toast.success("Tab transferred.");
            onBack();
        } else if (op === "merge" && selectedMerge) {
            const dest = mergeableTables.find((m) => m.table.id === selectedMerge);
            if (!dest?.bill) {
                toast.error("That table no longer has an open tab.");
                return;
            }
            setWorking("merge");
            const { data, error } = await db.mergeBills(bill.id, dest.bill.id, staffId);
            setWorking(null);
            if (error || !data.ok) {
                toast.error("Merge failed — try again.");
                return;
            }
            toast.success(`Merged with Table ${String(dest.table.number).padStart(2, "0")}.`);
            onBack();
        } else if (op === "split") {
            setWorking("split");
            const { data, error } = await db.splitBill(bill.id, ways, staffId);
            setWorking(null);
            if (error || !data.ok) {
                toast.error("Split failed — try again.");
                return;
            }
            toast.success(`Bill split ${ways} ways.`);
            onBack();
        }
    };

    const handleCloseTable = async () => {
        if (!bill) return;
        setWorking("close");
        const { ok, error } = await db.closeBill(bill.id, staffId);
        setWorking(null);
        setConfirmClose(false);
        if (!ok) {
            toast.error(error ? String((error as { message?: string }).message ?? error) : "Couldn't close this table");
            return;
        }
        onBack();
    };

    const canConfirm =
        !working &&
        ((op === "transfer" && selectedDest !== null) ||
            (op === "merge" && selectedMerge !== null) ||
            op === "split");

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
                {loading ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-isabelline">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-licorice/20 border-t-licorice" />
                        <p className="mt-4 text-[12px] font-bold tracking-tight text-feldgrau">
                            Loading…
                        </p>
                    </div>
                ) : !bill ? (
                    <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-isabelline">
                        <p className="text-[13px] font-bold tracking-tight text-licorice">
                            No open tab on this table
                        </p>
                        <p className="mt-1.5 text-[11px] tracking-tight text-feldgrau">
                            Table operations need an open bill. Guests scan the QR code to open one.
                        </p>
                    </div>
                ) : (
                    <>
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
                                        Move the entire open tab (<strong className="text-licorice">{formatGHS(billTotal)}</strong>) from Table {String(table.number).padStart(2, "0")} to another free table.
                                    </p>
                                </div>

                                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">
                                    Select destination
                                </p>
                                {transferableTables.length === 0 ? (
                                    <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-isabelline">
                                        <p className="text-[12px] font-medium tracking-tight text-feldgrau">
                                            No free tables to transfer to.
                                        </p>
                                    </div>
                                ) : (
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
                                                    <span className="mt-0.5 text-2xl font-bold font-sans tabular-nums text-slate-900 leading-none">
                                                        {String(t.number).padStart(2, "0")}
                                                    </span>
                                                    <span className={`mt-1 text-[8px] font-bold uppercase tracking-wider ${isSelected ? "opacity-80" : "text-feldgrau"}`}>
                                                        Free
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
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
                                            {mergeableTables.map(({ table: t, bill: b }) => {
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
                                                            <span className="text-2xl font-bold font-sans tabular-nums text-slate-900 leading-none">
                                                                {String(t.number).padStart(2, "0")}
                                                            </span>
                                                            <div className="text-left">
                                                                <p className={`text-[11px] font-bold tracking-tight ${isSelected ? "" : "text-licorice"}`}>
                                                                    Table {String(t.number).padStart(2, "0")}
                                                                </p>
                                                                <p className={`text-[10px] font-semibold ${isSelected ? "opacity-80" : "text-feldgrau"}`}>
                                                                    {b?.guest_count ?? 1} guests · {formatGHS(b?.total ?? 0)}
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
                                                    {formatGHS(billTotal + (mergeableTables.find((m) => m.table.id === selectedMerge)?.bill?.total ?? 0))}
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
                                        Split this tab into separate bills — one per guest. Items are balanced so each bill is roughly equal.
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

                                {/* Ways picker */}
                                <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-isabelline">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-bold tracking-tight text-licorice">
                                            Number of bills
                                        </span>
                                        <div className="flex items-center gap-2 rounded-full bg-isabelline p-1">
                                            <button
                                                type="button"
                                                onClick={() => setWays((w) => Math.max(2, w - 1))}
                                                disabled={ways <= 2}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-licorice shadow-sm transition-all active:scale-90 disabled:opacity-30"
                                            >
                                                <MinusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                            </button>
                                            <span className="w-8 text-center font-mono text-[14px] font-bold tabular-nums text-licorice">
                                                {ways}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setWays((w) => Math.min(12, w + 1))}
                                                disabled={ways >= 12}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-licorice text-isabelline transition-all active:scale-90 disabled:opacity-30"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Per bill amount */}
                                <div className="rounded-2xl bg-khaki/12 p-5">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                                        Per Bill
                                    </p>
                                    <p className="mt-1 font-mono text-[24px] font-black tabular-nums text-licorice">
                                        {formatGHS(perGuest)}
                                    </p>
                                    <p className="mt-1 text-[10px] font-semibold tracking-tight text-feldgrau">
                                        {ways} bills · balanced by item value
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                BOTTOM ACTION BAR
              ═══════════════════════════════════════════════════════════ */}
            {bill && (
                <div className="fixed inset-x-0 bottom-0 z-40 bg-isabelline/95 backdrop-blur-xl border-t border-licorice/8">
                    <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 md:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                        <button
                            type="button"
                            onClick={() => setConfirmClose(true)}
                            disabled={working !== null}
                            className={`
                                inline-flex items-center justify-center
                                rounded-full px-5 py-3
                                text-[12px] font-bold tracking-tight text-red-600
                                transition-all duration-200 active:scale-[0.98]
                                bg-red-50 hover:bg-red-100 disabled:opacity-40
                            `}
                        >
                            Close Table
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canConfirm}
                            className={`
                                inline-flex items-center justify-center gap-1.5
                                rounded-full px-5 py-3
                                text-[12px] font-bold tracking-tight
                                transition-all duration-200 active:scale-[0.98]
                                bg-licorice text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] hover:bg-licorice/95 disabled:opacity-40 disabled:shadow-none
                            `}
                        >
                            {working ? (
                                <>
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-isabelline/30 border-t-isabelline" />
                                    Working…
                                </>
                            ) : (
                                "Confirm"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── MODALS ── */}
            {confirmClose && bill && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-6" onClick={() => setConfirmClose(false)}>
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-[14px] font-bold text-licorice">Close this table?</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-feldgrau">
                            The bill will be cancelled and this table's session will end. Guests can re-scan
                            the QR to start fresh.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmClose(false)}
                                className="flex-1 rounded-full py-2.5 text-[12px] font-bold text-feldgrau ring-1 ring-licorice/10"
                            >
                                Keep open
                            </button>
                            <button
                                type="button"
                                onClick={handleCloseTable}
                                disabled={working === "close"}
                                className="flex-1 rounded-full py-2.5 text-[12px] font-bold text-white bg-red-700 disabled:opacity-50"
                            >
                                {working === "close" ? "…" : "Close table"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
