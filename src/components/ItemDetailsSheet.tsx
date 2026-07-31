import { useEffect, useMemo, useState } from "react";
import {
    CheckIcon,
    MinusIcon,
    PlusIcon,
    XMarkIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/react/24/solid";
import { formatGHS, type MenuItem, type ModifierGroup, type ModifierOption } from "../data/menu";
import { useTabStore } from "../store/useTabStore";

type Props = {
    item: MenuItem | null;
    onClose: () => void;
};

export function ItemDetailsSheet({ item, onClose }: Props) {
    const { addCustom } = useTabStore();
    const [qty, setQty] = useState(1);
    const [notes, setNotes] = useState("");
    /** selections: groupId -> Set<optionId>  (single-select groups still use a Set of size 1) */
    const [selections, setSelections] = useState<Record<string, Set<string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Reset state whenever a new item is opened
    useEffect(() => {
        if (item) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setQty(1);
            setNotes("");
            setSelections({});
            setSubmitting(false);
            setCurrentImageIndex(0);
            // Lock body scroll while sheet is open
            const prev = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [item]);

    // ESC key closes the sheet
    useEffect(() => {
        if (!item) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [item, onClose]);

    /** Compute the running total: base price + modifier deltas, × qty. */
    const unitPrice = useMemo(() => {
        if (!item) return 0;
        let p = item.price;
        for (const g of item.modifiers ?? []) {
            const sel = selections[g.id];
            if (!sel) continue;
            for (const opt of g.options) {
                if (sel.has(opt.id)) p += opt.priceDelta ?? 0;
            }
        }
        return p;
    }, [item, selections]);

    const totalPrice = unitPrice * qty;

    const isOpen = item !== null;

    const toggleOption = (group: ModifierGroup, opt: ModifierOption) => {
        setSelections((prev) => {
            const current = new Set(prev[group.id] ?? []);
            if (group.multiSelect) {
                if (current.has(opt.id)) {
                    current.delete(opt.id);
                } else {
                    if (group.max && current.size >= group.max) {
                        // Replace oldest — keep within max
                        const first = current.values().next().value;
                        if (first) current.delete(first);
                    }
                    current.add(opt.id);
                }
            } else {
                if (current.has(opt.id)) {
                    current.clear();
                } else {
                    current.clear();
                    current.add(opt.id);
                }
            }
            return { ...prev, [group.id]: current };
        });
    };

    const handleAdd = () => {
        if (!item) return;
        setSubmitting(true);
        const selectedModifiers = (item.modifiers ?? []).flatMap((g) => {
            const sel = selections[g.id];
            if (!sel) return [];
            return Array.from(sel).map((optId) => ({
                groupId: g.id,
                option: g.options.find((o) => o.id === optId)!,
            }));
        });
        // Tiny delay so the user perceives the press feedback
        window.setTimeout(() => {
            addCustom(item, selectedModifiers, notes, qty);
            onClose();
        }, 150);
    };

    if (!isOpen) return null;

    return (
        <div
            className="
                fixed inset-0 z-50
                flex items-end justify-center
            "
            role="dialog"
            aria-modal="true"
            aria-label={`${item.name} details`}
        >
            {/* ───── Backdrop — glassmorphic dim with blur ───── */}
            <button
                type="button"
                onClick={onClose}
                aria-label="Close item details"
                className="
                    absolute inset-0 cursor-default
                    bg-licorice/30 backdrop-blur-sm
                    animate-velvet-fade
                "
            />

            <div
                className="
                    relative z-10 flex w-full max-w-md md:max-w-2xl flex-col
                    rounded-t-[28px]
                    bg-isabelline
                    shadow-[0_-20px_60px_rgba(35,20,12,0.22)]
                    ring-1 ring-white/60
                    max-h-[92svh]
                    overflow-hidden
                    animate-velvet-sheet-up
                "
                style={{
                    animation: "velvet-sheet-up 380ms cubic-bezier(0.22, 1, 0.36, 1) both",
                }}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <span className="h-1 w-10 rounded-full bg-licorice/15" />
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto px-5 md:px-8 pb-6">
                    {/* ───── Hero image + close button ───── */}
                    <div className="relative mt-2">
                        <div
                            className="
                                relative h-64 w-full overflow-hidden
                                rounded-3xl ring-1 ring-white/60
                                shadow-[0_12px_40px_rgba(35,20,12,0.15)]
                            "
                        >
                            {(() => {
                                const images = item.gallery && item.gallery.length > 0 ? item.gallery : [item.image];
                                return (
                                    <>
                                        <div 
                                            className="flex h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                            style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                                        >
                                            {images.map((src, idx) => (
                                                <div key={idx} className="relative h-full w-full shrink-0">
                                                    <img
                                                        src={src}
                                                        alt={`${item.name} - ${idx + 1}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Carousel Controls */}
                                        {images.length > 1 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCurrentImageIndex((prev) => Math.max(0, prev - 1));
                                                    }}
                                                    disabled={currentImageIndex === 0}
                                                    className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-licorice shadow-md backdrop-blur-md transition-all hover:bg-white active:scale-90 disabled:opacity-0"
                                                >
                                                    <ChevronLeftIcon className="h-5 w-5" strokeWidth={2.5} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCurrentImageIndex((prev) => Math.max(0, Math.min(images.length - 1, prev + 1)));
                                                    }}
                                                    disabled={currentImageIndex === images.length - 1}
                                                    className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-licorice shadow-md backdrop-blur-md transition-all hover:bg-white active:scale-90 disabled:opacity-0"
                                                >
                                                    <ChevronRightIcon className="h-5 w-5" strokeWidth={2.5} />
                                                </button>

                                                {/* Pagination Dots */}
                                                <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1.5">
                                                    {images.map((_, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCurrentImageIndex(idx);
                                                            }}
                                                            aria-label={`Go to image ${idx + 1}`}
                                                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/60 hover:bg-white/90"}`}
                                                        />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Soft top scrim for close-button legibility */}
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-licorice/40 via-transparent to-transparent"
                            />
                        </div>

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="
                                absolute right-3 top-3 z-30
                                flex h-9 w-9 items-center justify-center
                                rounded-full
                                bg-white/85 backdrop-blur-md
                                ring-1 ring-white/70
                                shadow-[0_4px_12px_rgba(35,20,12,0.15)]
                                transition-all hover:bg-white active:scale-95
                            "
                        >
                            <XMarkIcon className="h-4 w-4 text-licorice" strokeWidth={2.25} />
                        </button>

                        {/* Tag chip (if any) — bottom-left of image */}
                        {item.tags && item.tags[0] && (
                            <div className="absolute bottom-3 left-3">
                                <span
                                    className="
                                        inline-flex items-center gap-1 rounded-full
                                        bg-white/90 backdrop-blur-md px-2.5 py-1
                                        text-[10px] font-semibold uppercase tracking-wider text-licorice
                                        ring-1 ring-white/70
                                    "
                                >
                                    <span className="h-1 w-1 rounded-full bg-khaki" />
                                    {item.tags[0]}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ───── Title + meta row ───── */}
                    <div className="mt-5">
                        <h2
                            className="
                                text-[24px] font-bold leading-[1.1] tracking-[-0.035em] text-licorice
                            "
                        >
                            {item.name}
                        </h2>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium tracking-tight text-feldgrau">
                            {item.abv && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-feldgrau/40" />
                                    ABV {item.abv}
                                </span>
                            )}
                            {item.origin && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-feldgrau/40" />
                                    {item.origin}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-feldgrau/40" />
                                {item.category}
                            </span>
                        </div>

                        <p className="mt-3 text-[13.5px] leading-[1.55] tracking-tight text-feldgrau">
                            {item.longDescription ?? item.description}
                        </p>
                    </div>

                    {/* ───── Modifier groups ───── */}
                    {item.modifiers && item.modifiers.length > 0 && (
                        <div className="mt-5 space-y-5">
                            {item.modifiers.map((group) => {
                                const sel = selections[group.id] ?? new Set<string>();
                                return (
                                    <fieldset key={group.id}>
                                        <legend className="flex items-baseline justify-between w-full">
                                            <span className="text-[13px] font-semibold tracking-tight text-licorice">
                                                {group.title}
                                                {group.required && (
                                                    <span className="ml-1 text-dark-red">·</span>
                                                )}
                                            </span>
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-feldgrau">
                                                {group.multiSelect
                                                    ? group.max
                                                        ? `Choose up to ${group.max}`
                                                        : "Choose any"
                                                    : "Choose one"}
                                            </span>
                                        </legend>

                                        <div className="mt-2 flex flex-col gap-1.5">
                                            {group.options.map((opt) => {
                                                const selected = sel.has(opt.id);
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => toggleOption(group, opt)}
                                                        className={`
                                                            flex w-full items-center justify-between
                                                            rounded-xl px-3 py-2.5
                                                            text-left text-[13px]
                                                            transition-all duration-150 ease-out
                                                            ring-1
                                                            ${selected
                                                                ? "bg-licorice text-isabelline ring-licorice shadow-[0_4px_12px_rgba(35,20,12,0.15)]"
                                                                : "bg-white/70 text-licorice ring-white/70 hover:bg-white hover:ring-licorice/15"
                                                            }
                                                        `}
                                                    >
                                                        <span className="flex items-center gap-2.5">
                                                            <span
                                                                className={`
                                                                    flex h-4 w-4 items-center justify-center
                                                                    ${group.multiSelect
                                                                        ? "rounded-[4px]"
                                                                        : "rounded-full"
                                                                    }
                                                                    ${selected
                                                                        ? "bg-isabelline text-licorice"
                                                                        : "bg-isabelline/40 text-transparent ring-1 ring-licorice/20"
                                                                    }
                                                                `}
                                                            >
                                                                <CheckIcon className="h-3 w-3" strokeWidth={3} />
                                                            </span>
                                                            <span className="font-medium tracking-tight">
                                                                {opt.name}
                                                            </span>
                                                        </span>
                                                        {opt.priceDelta ? (
                                                            <span
                                                                className={`
                                                                    font-mono text-[11px] font-semibold tracking-tight
                                                                    ${selected ? "text-isabelline/80" : "text-khaki"}
                                                                `}
                                                            >
                                                                +{formatGHS(opt.priceDelta)}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </fieldset>
                                );
                            })}
                        </div>
                    )}

                    {/* ───── Special instructions ───── */}
                    <div className="mt-5">
                        <label
                            htmlFor="special-instructions"
                            className="flex items-baseline justify-between"
                        >
                            <span className="text-[13px] font-semibold tracking-tight text-licorice">
                                Special Instructions
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-feldgrau">
                                Optional
                            </span>
                        </label>
                        <textarea
                            id="special-instructions"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value.slice(0, 140))}
                            placeholder="e.g. extra cold, no sugar rim, allergy note…"
                            rows={2}
                            className="
                                mt-2 w-full resize-none rounded-xl
                                bg-white/70 backdrop-blur-md
                                px-3 py-2.5
                                text-[13px] text-licorice
                                placeholder:text-feldgrau/60
                                ring-1 ring-white/70
                                focus:outline-none focus:ring-2 focus:ring-licorice/30
                                transition-all
                            "
                        />
                        <div className="mt-1 text-right text-[10px] font-medium tracking-tight text-feldgrau/70">
                            {notes.length}/140
                        </div>
                    </div>
                </div>

                {/* ───── Sticky footer: quantity stepper + Add CTA ───── */}
                <div
                    className="
                        shrink-0 border-t border-licorice/8
                        bg-isabelline
                        px-5 md:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]
                    "
                >
                    <div className="flex items-center gap-3">
                        {/* Quantity stepper */}
                        <div
                            className="
                                flex items-center gap-1 rounded-full
                                bg-white/80 backdrop-blur-md ring-1 ring-white/70
                                px-1 py-1
                            "
                        >
                            <button
                                type="button"
                                onClick={() => setQty((q) => Math.max(1, q - 1))}
                                disabled={qty <= 1}
                                aria-label="Decrease quantity"
                                className="
                                    flex h-9 w-9 items-center justify-center rounded-full
                                    text-licorice transition-colors
                                    hover:bg-isabelline active:scale-95
                                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
                                "
                            >
                                <MinusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                            <span className="w-6 text-center font-mono text-[14px] font-bold tabular-nums text-licorice">
                                {qty}
                            </span>
                            <button
                                type="button"
                                onClick={() => setQty((q) => Math.min(99, q + 1))}
                                aria-label="Increase quantity"
                                className="
                                    flex h-9 w-9 items-center justify-center rounded-full
                                    bg-licorice text-isabelline transition-colors
                                    hover:bg-licorice/90 active:scale-95
                                "
                            >
                                <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Add to cart CTA */}
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={submitting}
                            className="
                                group flex flex-1 items-center justify-between
                                rounded-full bg-licorice
                                px-5 py-3
                                shadow-[0_12px_28px_rgba(35,20,12,0.20)]
                                ring-1 ring-licorice/80
                                transition-all duration-200 ease-out
                                hover:bg-licorice/95 hover:shadow-[0_16px_34px_rgba(35,20,12,0.24)]
                                active:scale-[0.985]
                                disabled:opacity-90
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-khaki
                            "
                        >
                            <span className="text-[13px] font-semibold tracking-tight text-isabelline">
                                {submitting ? "Adding…" : `Add to Cart`}
                            </span>
                            <span className="font-mono text-[14px] font-bold tabular-nums text-isabelline">
                                {formatGHS(totalPrice)}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Keyframes for sheet slide-up — scoped to global via <style> tag */}
            <style>{`
                @keyframes velvet-sheet-up {
                    from { transform: translateY(100%); opacity: 0.4; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .animate-velvet-sheet-up { animation: none !important; }
                }
            `}</style>
        </div>
    );
}
