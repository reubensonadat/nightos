import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

type Props = {
    children: React.ReactNode;
    fileName?: string;
};

function triggerBlobDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        if (document.body.contains(link)) {
            document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
    }, 200);
}

export function ReceiptDownloader({ children, fileName = "receipt.png" }: Props) {
    const printRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        const element = printRef.current;
        if (!element || downloading) return;

        setDownloading(true);

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
            });

            // Convert canvas to Blob safely
            let blob: Blob | null = null;
            try {
                blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            } catch {
                // Ignore blob conversion errors and proceed to data URL fallback
            }

            if (blob) {
                const file = new File([blob], fileName, { type: "image/png" });
                if (
                    navigator.share &&
                    navigator.canShare &&
                    navigator.canShare({ files: [file] })
                ) {
                    await navigator.share({
                        files: [file],
                        title: "Receipt",
                        text: "Here is your receipt",
                    }).catch(() => {
                        triggerBlobDownload(blob!, fileName);
                    });
                } else {
                    triggerBlobDownload(blob, fileName);
                    toast.success("Receipt saved!");
                }
            } else {
                // Fallback to data URL download
                const dataUrl = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    if (document.body.contains(link)) document.body.removeChild(link);
                }, 200);
                toast.success("Receipt saved!");
            }
        } catch (error) {
            console.error("Failed to generate receipt", error);
            toast.error("Could not save receipt.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            {/* The printable area */}
            <div ref={printRef} className="w-full bg-white p-4 shadow-sm border border-black/5 rounded-xl">
                {children}
            </div>

            {/* Download button (not captured in image) */}
            <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-licorice px-5 py-3 text-[13px] font-bold tracking-tight text-isabelline shadow-[0_8px_16px_rgba(35,20,12,0.15)] ring-1 ring-licorice/80 transition-all duration-200 hover:bg-licorice/95 hover:shadow-[0_12px_24px_rgba(35,20,12,0.20)] active:scale-95 disabled:opacity-60"
            >
                {downloading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-isabelline/30 border-t-isabelline" />
                ) : (
                    <ArrowDownTrayIcon className="h-4 w-4" strokeWidth={2.5} />
                )}
                {downloading ? "Saving Receipt..." : "Save Receipt"}
            </button>
        </div>
    );
}
