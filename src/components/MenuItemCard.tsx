import React from 'react';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { HeartIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatGHS } from '../data/menu';

export interface MenuItemCardProps {
    id: string;
    name: string;
    price: number;
    image?: string | null;
    description?: string | null;
    category?: string;
    abv?: string | number | null;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
    onClick: () => void;
    onAdd: () => void;
    animationDelayMs?: number;
}

export function MenuItemCard({
    name,
    price,
    image,
    description,
    category,
    abv,
    isFavorite,
    onToggleFavorite,
    onClick,
    onAdd,
    animationDelayMs = 0,
}: MenuItemCardProps) {
    return (
        <article
            className="animate-velvet-rise group relative flex flex-col"
            style={{ animationDelay: `${animationDelayMs}ms` }}
        >
            {/* Image Section (Completely separate from text) */}
            <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-[24px] bg-black/5 shadow-sm">
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={`View details for ${name}`}
                    className="absolute inset-0 z-10 block"
                />
                {image ? (
                    <img
                        src={image}
                        alt={name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-licorice/85 to-licorice">
                        <span className="font-serif text-[40px] font-bold text-isabelline/80">
                            {name.charAt(0)}
                        </span>
                    </div>
                )}

                {/* Top-right Heart Button (Only show if onToggleFavorite is provided) */}
                {onToggleFavorite && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite();
                        }}
                        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        aria-pressed={isFavorite}
                        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-md transition-transform active:scale-90"
                    >
                        {isFavorite ? (
                            <HeartIconSolid className="h-4 w-4 text-dark-red" />
                        ) : (
                            <HeartIcon className="h-4 w-4 text-licorice" strokeWidth={2.5} />
                        )}
                    </button>
                )}
            </div>

            {/* Information Section (No white background) */}
            <div className="mt-3 flex flex-col px-1">
                {/* Row 1: Price and Plus Button */}
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[16px] font-bold text-licorice">
                        {formatGHS(price)}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdd();
                        }}
                        aria-label={`Add ${name} to cart`}
                        className="relative z-20 flex h-8 w-8 items-center justify-end text-licorice transition-transform hover:opacity-70 active:scale-90"
                    >
                        <PlusIcon className="h-6 w-6" strokeWidth={2.5} />
                    </button>
                </div>

                {/* Row 2: Name */}
                <button
                    type="button"
                    onClick={onClick}
                    className="mt-1 text-left"
                >
                    <h3 className="line-clamp-1 text-[14px] font-bold leading-tight tracking-tight text-licorice">
                        {name}
                    </h3>
                </button>

                {/* Row 3: Description (or category/abv if no description) */}
                <p className="mt-1 line-clamp-2 text-[11px] leading-[1.4] text-feldgrau">
                    {description || (abv ? `ABV ${abv} • ${category}` : category)}
                </p>
            </div>
        </article>
    );
}
