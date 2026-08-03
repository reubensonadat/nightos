import { useMemo } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type Props = {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageSize?: number;
};

/**
 * Numbered pagination bar — shows up to 7 page buttons (1 2 3 … n)
 * plus prev/next. Use with the paginated `db.*ByVenue` queries.
 */
export function PaginationBar({ page, totalPages, onPageChange }: Props) {
    const pages = useMemo(() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        // 7 buttons: first, last, current ±2, ellipses as needed
        const set = new Set<number>([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
        const sorted = [...set]
            .filter((p) => p >= 1 && p <= totalPages)
            .sort((a, b) => a - b);
        const out: (number | "…")[] = [];
        let prev = 0;
        for (const p of sorted) {
            if (p - prev > 1) out.push("…");
            out.push(p);
            prev = p;
        }
        return out;
    }, [page, totalPages]);

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-1.5 pt-4 pb-2">
            <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/8 transition-all hover:bg-isabelline active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
                <ChevronLeftIcon className="h-4 w-4" strokeWidth={2.25} />
            </button>

            {pages.map((p, i) =>
                p === "…" ? (
                    <span key={`e-${i}`} className="px-1 text-[11px] font-bold text-feldgrau/60">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange(p)}
                        aria-label={`Page ${p}`}
                        aria-current={p === page ? "page" : undefined}
                        className={`
                            flex h-8 min-w-8 items-center justify-center rounded-full px-2
                            text-[12px] font-bold tabular-nums transition-all active:scale-95
                            ${p === page
                                ? "bg-licorice text-isabelline shadow-[0_4px_12px_rgba(35,20,12,0.2)]"
                                : "bg-white text-feldgrau ring-1 ring-licorice/8 hover:text-licorice hover:ring-licorice/15"
                            }
                        `}
                    >
                        {p}
                    </button>
                ),
            )}

            <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-licorice ring-1 ring-licorice/8 transition-all hover:bg-isabelline active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
                <ChevronRightIcon className="h-4 w-4" strokeWidth={2.25} />
            </button>
        </div>
    );
}
