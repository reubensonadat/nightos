import { useState } from "react";
import { KeyIcon, CheckIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

type Props = {
  pin: string;
  tableLabel?: string | null;
};

export function TablePinBanner({ pin, tableLabel }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    toast.success(`Table PIN ${pin} copied! Share with your friends.`);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-white/20 active:scale-95"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3.5 w-3.5 text-khaki" strokeWidth={2.5} />
              <span className="text-khaki">Copied</span>
            </>
          ) : (
            <>
              <DocumentDuplicateIcon className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
              <span>Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
