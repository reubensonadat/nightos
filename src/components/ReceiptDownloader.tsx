import { useRef } from "react";
import html2canvas from "html2canvas";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

type Props = {
    children: React.ReactNode;
    fileName?: string;
};

export function ReceiptDownloader({ children, fileName = "receipt.png" }: Props) {
    const printRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        const element = printRef.current;
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
            });

            const data = canvas.toDataURL("image/png");
            const link = document.createElement("a");

            if (typeof link.download === "string") {
                link.href = data;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                window.open(data);
            }
        } catch (error) {
            console.error("Failed to generate receipt", error);
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
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-licorice px-5 py-3 text-[13px] font-bold tracking-tight text-isabelline shadow-[0_8px_16px_rgba(35,20,12,0.15)] ring-1 ring-licorice/80 transition-all duration-200 hover:bg-licorice/95 hover:shadow-[0_12px_24px_rgba(35,20,12,0.20)] active:scale-95"
            >
                <ArrowDownTrayIcon className="h-4 w-4" strokeWidth={2.5} />
                Save Receipt
            </button>
        </div>
    );
}
