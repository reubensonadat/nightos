import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { formatGHS } from "../data/menu";
import { useTabComputed } from "../store/useTabStore";

type Props = {
    onViewCart: () => void;
    onViewTracking: () => void;
};

export function TabPill({ onViewCart, onViewTracking }: Props) {
    const { totalItems, tabSubtotal, cartItemCount } = useTabComputed();

    if (totalItems === 0) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3 bg-gradient-to-t from-isabelline via-isabelline/95 to-transparent pointer-events-none">
            <button
                type="button"
                onClick={cartItemCount > 0 ? onViewCart : onViewTracking}
                className="
                    group animate-velvet-rise flex w-full max-w-md md:max-w-2xl items-center justify-between
                    gap-3 rounded-full bg-licorice px-6 py-4
                    shadow-[0_20px_50px_rgba(35,20,12,0.25)]
                    ring-1 ring-licorice/80
                    transition-all duration-200 ease-out
                    hover:bg-licorice/95 hover:shadow-[0_24px_60px_rgba(35,20,12,0.30)]
                    active:scale-[0.985]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                    pointer-events-auto
                "
                aria-label={`View tab — ${totalItems} items, ${formatGHS(tabSubtotal)}`}
            >
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline/15 text-[13px] font-bold text-isabelline ring-1 ring-isabelline/20">
                        {totalItems}
                    </span>
                    <div className="flex flex-col items-start leading-tight">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-khaki">
                            Your tab
                        </span>
                        <span className="font-mono text-[15px] font-bold tabular-nums text-isabelline">
                            {formatGHS(tabSubtotal)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[15px] font-bold tracking-tight text-isabelline">
                        {cartItemCount > 0 ? "View Cart" : "Track Order"}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-isabelline text-licorice transition-transform duration-200 group-hover:translate-x-0.5">
                        <ArrowRightIcon className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                </div>
            </button>
        </div>
    );
}
