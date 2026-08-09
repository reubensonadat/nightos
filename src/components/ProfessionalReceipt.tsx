import { formatGHS } from "../data/menu";

export type ReceiptLine = {
    name: string;
    qty: number;
    lineTotal: number;
};

type Props = {
    venueName: string;
    venueContact?: string | null;
    refCode: string;
    dateISO: string;
    statusLabel?: string;
    servedLabel?: string;
    items: ReceiptLine[];
    subtotal: number;
    vat: number;
    total: number;
};

/**
 * Professional receipt card — Vendly-style invoice layout, adapted for Bysen:
 * header masthead, meta blocks (Served To / Details), item table, VAT row,
 * Total band. No watermark, no delivery fee, no service charge.
 */
export function ProfessionalReceipt({
    venueName,
    venueContact,
    refCode,
    dateISO,
    statusLabel,
    servedLabel,
    items,
    subtotal,
    vat,
    total,
}: Props) {
    const date = new Date(dateISO).toLocaleDateString("en-GH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    return (
        <div className="bg-white text-[#111111] font-sans">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-6 px-7 pt-7">
                <div>
                    <p className="text-[22px] font-semibold tracking-tight text-licorice">{venueName}</p>
                    {venueContact && (
                        <p className="mt-0.5 text-[13px] text-feldgrau/70">{venueContact}</p>
                    )}
                </div>
                <p className="text-[30px] font-light tracking-[-0.02em] text-feldgrau/80">
                    RECEIPT
                </p>
            </div>

            {/* ── Meta ── */}
            <div className="mt-8 flex justify-between gap-6 px-7 text-[13px]">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-feldgrau/50">
                        Served To
                    </p>
                    <p className="mt-1 font-medium text-licorice">{servedLabel || "Guest"}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-feldgrau/50">
                        Details
                    </p>
                    <p className="mt-1 text-licorice">
                        <span className="font-medium">Ref:</span>{" "}
                        <span className="text-feldgrau/70">#{refCode}</span>
                    </p>
                    <p className="mt-1 text-licorice">
                        <span className="font-medium">Date:</span>{" "}
                        <span className="text-feldgrau/70">{date}</span>
                    </p>
                    {statusLabel && (
                        <p className="mt-1 text-licorice">
                            <span className="font-medium">Status:</span>{" "}
                            <span className="text-feldgrau/70">{statusLabel}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* ── Item table ── */}
            <table className="mt-8 w-full border-collapse px-7">
                <thead>
                    <tr>
                        <th className="border-b border-licorice/10 pb-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-feldgrau/50">
                            Item
                        </th>
                        <th className="border-b border-licorice/10 pb-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-feldgrau/50">
                            Qty
                        </th>
                        <th className="border-b border-licorice/10 pb-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-feldgrau/50">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 && (
                        <tr>
                            <td className="border-b border-licorice/5 py-4 text-[13px] text-feldgrau/50" colSpan={3}>
                                No items on this receipt.
                            </td>
                        </tr>
                    )}
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td className="border-b border-licorice/5 py-3.5 text-[14px] font-medium text-licorice">
                                {item.name}
                            </td>
                            <td className="border-b border-licorice/5 py-3.5 text-right text-[14px] text-feldgrau/70">
                                {item.qty}
                            </td>
                            <td className="border-b border-licorice/5 py-3.5 text-right text-[14px] text-licorice">
                                {formatGHS(item.lineTotal)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── Totals (no service charge, no delivery fee) ── */}
            <div className="px-7 pt-4 pb-6">
                <div className="ml-auto w-full max-w-[260px] space-y-1.5 text-[13px]">
                    <div className="flex justify-between text-feldgrau">
                        <span>Subtotal</span>
                        <span className="font-mono tabular-nums">{formatGHS(subtotal)}</span>
                    </div>
                    {vat > 0 && (
                        <div className="flex justify-between text-feldgrau">
                            <span>VAT</span>
                            <span className="font-mono tabular-nums">{formatGHS(vat)}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-licorice/10 pt-2.5 text-[16px] font-semibold text-licorice">
                        <span>Total Amount</span>
                        <span className="font-mono tabular-nums">{formatGHS(total)}</span>
                    </div>
                </div>

                <p className="mt-8 border-t border-licorice/10 pt-4 text-center text-[12px] text-feldgrau/50">
                    Thank you for dining with {venueName}!
                </p>
            </div>
        </div>
    );
}