export type MenuCategory = string;

export type ModifierOption = {
    id: string;
    name: string;
    priceDelta?: number; // optional additional cost in GHS
};

export type ModifierGroup = {
    id: string;
    title: string;
    required?: boolean;
    multiSelect?: boolean;
    max?: number;
    options: ModifierOption[];
};

export type MenuItem = {
    id: string;
    name: string;
    description: string;
    longDescription?: string;
    price: number; // in GHS
    category: MenuCategory;
    /** Station this item is prepared at — sourced from products.station in the DB. */
    station?: 'kitchen' | 'bar' | 'both';
    image: string;
    gallery?: string[];
    tags?: ("Popular" | "New" | "Chef's Pick" | "Vegetarian")[];
    abv?: string; // alcohol by volume (for drinks)
    origin?: string; // origin region (for wines/spirits)
    modifiers?: ModifierGroup[];
};

import React from 'react';

/** Format a number as GHS currency with thousands separators and 2 decimals. */
export function formatGHS(amount: number): React.ReactNode {
    return React.createElement(
        "span",
        { className: "whitespace-nowrap inline-flex items-baseline" },
        React.createElement("span", { className: "text-[0.8em] opacity-70 font-semibold mr-[2px]" }, "GH\u20B5"),
        React.createElement("span", null, amount.toLocaleString("en-GH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }))
    );
}

export function formatGHSString(amount: number): string {
    return `GH\u20B5 ${amount.toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
