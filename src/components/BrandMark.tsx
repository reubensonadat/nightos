import { MapPinIcon } from "@heroicons/react/24/solid";

type Props = {
    size?: "sm" | "md";
    showLabel?: boolean;
};

/**
 * Velvet Lounge brand mark — the "V" pill.
 * Used in the top-left of every customer screen for brand consistency.
 */
export function BrandMark({ size = "md", showLabel = true }: Props) {
    const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
    const glyph = size === "sm" ? "text-[13px]" : "text-[15px]";

    return (
        <div className="flex items-center gap-2.5">
            <div
                className={`
          flex ${dim} items-center justify-center
          rounded-full bg-licorice text-isabelline
          shadow-[0_4px_14px_rgba(35,20,12,0.18)]
        `}
            >
                <span className={`font-serif ${glyph} font-bold leading-none tracking-tight`}>
                    V
                </span>
            </div>
            {showLabel && (
                <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-semibold tracking-tight text-licorice">
                        Velvet Lounge
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-feldgrau">
                        Powered by Bysen
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * Table confirmation badge — uses Dark Red as the critical-context accent.
 */
export function TableBadge({ table = "04" }: { table?: string }) {
    return (
        <div
            className="
        inline-flex items-center gap-1.5 rounded-full
        bg-dark-red/10 px-3 py-1.5
        ring-1 ring-dark-red/20
      "
        >
            <MapPinIcon className="h-3.5 w-3.5 text-dark-red" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-red">
                Table {table}
            </span>
        </div>
    );
}
