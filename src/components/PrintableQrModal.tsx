import React, { useState, useEffect, useRef } from "react";
import { XMarkIcon, ArrowDownTrayIcon, LinkIcon, CheckIcon } from "@heroicons/react/24/outline";
import QRCode from "qrcode";
import { downloadPrintableQrCard } from "../utils/qrCardGenerator";
import toast from "react-hot-toast";

export interface PrintableQrModalProps {
    isOpen: boolean;
    onClose: () => void;
    tableNumber: number;
    tableLabel?: string;
    area?: string;
    venueName?: string;
    qrCodeToken: string;
}

export const PrintableQrModal: React.FC<PrintableQrModalProps> = ({
    isOpen,
    onClose,
    tableNumber,
    tableLabel,
    area,
    venueName,
    qrCodeToken,
}) => {
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const qrUrl = `${window.location.origin}/?table=${encodeURIComponent(qrCodeToken)}`;
    const displayVenue = (venueName && venueName.trim() ? venueName.trim() : "BYSEN").toUpperCase();
    const tableTitle = tableLabel || `TABLE ${String(tableNumber).padStart(2, "0")}`;
    const tableDetail = area ? `${tableTitle.toUpperCase()} · ${area.toUpperCase()}` : tableTitle.toUpperCase();

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, qrUrl, {
                width: 210,
                margin: 1,
                color: {
                    dark: "#000000",
                    light: "#FFFFFF",
                },
            }).catch(console.error);
        }
    }, [isOpen, qrUrl]);

    if (!isOpen) return null;

    const handleDownload = async () => {
        try {
            await downloadPrintableQrCard({
                tableNumber,
                tableLabel,
                area,
                venueName,
                qrUrl,
            });
            toast.success(`Downloaded Table ${String(tableNumber).padStart(2, "0")} QR Code`);
        } catch {
            toast.error("Failed to download QR code.");
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(qrUrl);
            setCopied(true);
            toast.success("Link copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Could not copy link.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-licorice/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-sm overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-isabelline px-5 py-3">
                    <div>
                        <p className="text-xs font-bold uppercase text-feldgrau">QR Code Card</p>
                        <h3 className="text-[14px] font-bold tracking-tight text-licorice">
                            Table {String(tableNumber).padStart(2, "0")}{area ? ` · ${area}` : ""}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-isabelline text-licorice transition-colors hover:bg-isabelline/70"
                    >
                        <XMarkIcon className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                </div>

                {/* Printable Card Live Preview */}
                <div className="p-4 bg-isabelline/40">
                    <div className="flex flex-col items-center rounded-xl bg-white p-5 shadow-sm border border-black/5 text-center">
                        {/* Venue Name */}
                        <h2 className="font-serif text-2xl font-bold tracking-widest text-slate-900 uppercase">
                            {displayVenue}
                        </h2>

                        {/* MENU */}
                        <h3 className="mt-2 text-sm font-bold tracking-[0.25em] text-slate-900 uppercase">
                            MENU
                        </h3>

                        {/* Table / Area Detail */}
                        <p className="mt-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                            {tableDetail}
                        </p>

                        {/* Streamlined Call to Action */}
                        <p className="mt-3.5 text-xs font-bold tracking-[0.2em] text-slate-800 uppercase">
                            SCAN TO ORDER
                        </p>

                        {/* QR Code Canvas */}
                        <div className="mt-4 flex justify-center">
                            <canvas ref={canvasRef} className="rounded-md border border-slate-100" />
                        </div>

                        {/* URL Subtext */}
                        <p className="mt-2.5 break-all text-[10px] tracking-tight text-slate-400">
                            {qrUrl}
                        </p>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="grid grid-cols-2 gap-2 border-t border-isabelline p-3">
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-isabelline px-4 py-2.5 text-xs font-bold tracking-tight text-licorice ring-1 ring-licorice/8 active:scale-95 transition-transform"
                    >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        Download PNG
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-licorice px-4 py-2.5 text-xs font-bold tracking-tight text-isabelline active:scale-95 transition-transform"
                    >
                        {copied ? (
                            <>
                                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
                                Copied!
                            </>
                        ) : (
                            <>
                                <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
                                Copy Link
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
