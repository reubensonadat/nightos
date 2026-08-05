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

/** Format a number as GHS currency with thousands separators and 2 decimals. */
export function formatGHS(amount: number): string {
    return `GHS ${amount.toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
