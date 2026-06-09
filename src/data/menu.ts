export type MenuCategory = "Signatures" | "Spirits" | "Wines" | "Small Plates";

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
    image: string;
    gallery?: string[];
    tags?: ("Popular" | "New" | "Chef's Pick" | "Vegetarian")[];
    abv?: string; // alcohol by volume (for drinks)
    origin?: string; // origin region (for wines/spirits)
    modifiers?: ModifierGroup[];
};

/* ───────────────────────── Modifier group library ─────────────────────────
 * Reusable modifier groups shared across items to keep data DRY. */

const ICE_GROUP: ModifierGroup = {
    id: "ice",
    title: "Ice",
    options: [
        { id: "ice-regular", name: "Regular" },
        { id: "ice-light", name: "Light" },
        { id: "ice-extra", name: "Extra" },
        { id: "ice-none", name: "None (Neat)" },
    ],
};

const STRENGTH_GROUP: ModifierGroup = {
    id: "strength",
    title: "Strength",
    options: [
        { id: "str-light", name: "Light" },
        { id: "str-regular", name: "Regular" },
        { id: "str-strong", name: "Strong (+GHS 20)", priceDelta: 20 },
    ],
};

const GARNISH_GROUP: ModifierGroup = {
    id: "garnish",
    title: "Garnish",
    multiSelect: true,
    max: 3,
    options: [
        { id: "gar-olive", name: "Olives" },
        { id: "gar-twist", name: "Citrus Twist" },
        { id: "gar-cherry", name: "Brandied Cherry (+GHS 10)", priceDelta: 10 },
        { id: "gar-herb", name: "Fresh Herbs" },
    ],
};

const SERVE_GROUP: ModifierGroup = {
    id: "serve",
    title: "Serve",
    options: [
        { id: "srv-neat", name: "Neat" },
        { id: "srv-rocks", name: "On the Rocks" },
        { id: "srv-up", name: "Up (Coupe)" },
    ],
};

const WINE_POUR_GROUP: ModifierGroup = {
    id: "pour",
    title: "Pour",
    options: [
        { id: "pour-glass", name: "Glass (150ml)" },
        { id: "pour-bottle", name: "Bottle (750ml, +GHS 280)", priceDelta: 280 },
    ],
};

const PLATE_SIDE_GROUP: ModifierGroup = {
    id: "side",
    title: "Side",
    options: [
        { id: "side-bread", name: "Warm Sourdough" },
        { id: "side-greens", name: "Garden Greens" },
        { id: "side-pickles", name: "House Pickles" },
        { id: "side-none", name: "No Side" },
    ],
};

/**
 * Velvet Lounge signature menu — curated for the customer web app.
 * Imagery is sourced from Unsplash (free, premium editorial quality).
 * Prices are in GHS (Ghanaian Cedi) as per the brief.
 */
export const MENU: MenuItem[] = [
    // ─── Signatures ───────────────────────────────────────────────
    {
        id: "sig-velvet-negroni",
        name: "Velvet Negroni",
        description:
            "Botanical gin, Campari, sweet vermouth and a single smoked ice cube.",
        longDescription:
            "Our house signature. Built on a foundation of botanical gin, balanced with bitter Campari and sweet vermouth, then finished with a single smoked ice cube that releases aroma as it melts.",
        price: 110,
        category: "Signatures",
        image:
            "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80"
        ],
        tags: ["Chef's Pick"],
        abv: "24%",
        modifiers: [ICE_GROUP, STRENGTH_GROUP, GARNISH_GROUP],
    },
    {
        id: "sig-smoked-old-fashioned",
        name: "Smoked Old Fashioned",
        description:
            "Aged bourbon, demerara, orange bitters, finished under applewood smoke.",
        longDescription:
            "Aged Kentucky bourbon, demerara syrup and orange bitters, stirred over a single hand-cut ice cube and finished under a glass dome of applewood smoke at the table.",
        price: 130,
        category: "Signatures",
        image:
            "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=900&q=80"
        ],
        tags: ["Popular"],
        abv: "32%",
        modifiers: [ICE_GROUP, STRENGTH_GROUP, GARNISH_GROUP],
    },
    {
        id: "sig-velvet-martini",
        name: "Velvet Martini",
        description:
            "London Dry gin, dry vermouth, olive brine, served with three Castelvetrano olives.",
        longDescription:
            "London Dry gin, a whisper of dry vermouth and a dash of olive brine, stirred over cracked ice and served up in a chilled coupe with three Castelvetrano olives.",
        price: 105,
        category: "Signatures",
        image:
            "https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=900&q=80",
        abv: "28%",
        modifiers: [STRENGTH_GROUP, GARNISH_GROUP],
    },
    {
        id: "sig-hibiscus-spritz",
        name: "Hibiscus Spritz",
        description:
            "Prosecco, hibiscus cordial, fresh lime, topped with soda and edible petals.",
        longDescription:
            "A floral, refreshing spritz — Prosecco, house hibiscus cordial and fresh lime, topped with soda and finished with edible petals. Light, tart, and unmistakably velvet.",
        price: 95,
        category: "Signatures",
        image:
            "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80",
        tags: ["New"],
        abv: "11%",
        modifiers: [ICE_GROUP, GARNISH_GROUP],
    },

    // ─── Spirits ──────────────────────────────────────────────────
    {
        id: "spr-macallan-12",
        name: "Macallan 12 Double Cask",
        description:
            "Single malt Scotch, sherry and bourbon cask finish. Served neat or on the rock.",
        longDescription:
            "Single malt Scotch from Speyside, matured in a balance of European and American oak casks. Notes of dried fruits, oak and ginger on the finish.",
        price: 220,
        category: "Spirits",
        image:
            "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=80",
        tags: ["Chef's Pick"],
        abv: "43%",
        origin: "Speyside, Scotland",
        modifiers: [SERVE_GROUP],
    },
    {
        id: "spr-don-julio-1942",
        name: "Don Julio 1942",
        description:
            "Añejo tequila, aged 2.5 years. Caramel, vanilla and toasted agave on the nose.",
        longDescription:
            "Añejo tequila aged for two and a half years in American white oak. Caramel, vanilla and toasted agave on the nose, with a long warm finish.",
        price: 280,
        category: "Spirits",
        image:
            "https://images.unsplash.com/photo-1568213816046-0a1aacc8d6cf?auto=format&fit=crop&w=900&q=80",
        tags: ["Popular"],
        abv: "40%",
        origin: "Jalisco, Mexico",
        modifiers: [SERVE_GROUP],
    },
    {
        id: "spr-hendricks",
        name: "Hendrick's Gin",
        description:
            "Cucumber and rose-infused Scottish gin. Served with premium tonic and a citrus twist.",
        longDescription:
            "Cucumber and rose-infused Scottish gin, served tall with premium tonic, fresh citrus and a single cucumber ribbon.",
        price: 90,
        category: "Spirits",
        image:
            "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=900&q=80",
        abv: "41%",
        origin: "Girvan, Scotland",
        modifiers: [ICE_GROUP, GARNISH_GROUP],
    },

    // ─── Wines ────────────────────────────────────────────────────
    {
        id: "win-chianti-riserva",
        name: "Chianti Riserva '19",
        description:
            "Tuscan Sangiovese, cherry and tobacco. Bold, structured, ready for red meat.",
        longDescription:
            "Tuscan Sangiovese from the 2019 vintage. Cherry, dried herbs and tobacco on the nose, with structured tannins and a long savoury finish. A natural pairing for red meat and aged cheeses.",
        price: 180,
        category: "Wines",
        image:
            "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
        tags: ["Chef's Pick"],
        abv: "13.5%",
        origin: "Tuscany, Italy",
        modifiers: [WINE_POUR_GROUP],
    },
    {
        id: "win-sancerre",
        name: "Sancerre Blanc '21",
        description:
            "Loire Valley Sauvignon Blanc. Crisp citrus, flint minerality, a clean finish.",
        longDescription:
            "Loire Valley Sauvignon Blanc from the 2021 vintage. Crisp citrus, flint minerality and a clean, bracing finish. Pairs beautifully with oysters and light seafood.",
        price: 160,
        category: "Wines",
        image:
            "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=900&q=80",
        abv: "12.5%",
        origin: "Loire, France",
        modifiers: [WINE_POUR_GROUP],
    },
    {
        id: "win-champagne",
        name: "Champagne Brut",
        description:
            "House pour — brioche, green apple and a fine bead. By the glass or bottle.",
        longDescription:
            "Our house Champagne — brioche, green apple and a fine, persistent bead. Equally at home as an aperitif or alongside oysters and charcuterie.",
        price: 145,
        category: "Wines",
        image:
            "https://images.unsplash.com/photo-1547595809-2cf98295a3f5?auto=format&fit=crop&w=900&q=80",
        tags: ["Popular"],
        abv: "12%",
        origin: "Champagne, France",
        modifiers: [WINE_POUR_GROUP],
    },

    // ─── Small Plates ─────────────────────────────────────────────
    {
        id: "sp-charcuterie",
        name: "Charcuterie Board",
        description:
            "Cured meats, aged cheeses, house pickles, fig jam and warm sourdough.",
        longDescription:
            "A curated board of cured meats and aged cheeses, finished with house pickles, fig jam and warm sourdough. Built for sharing at the table.",
        price: 220,
        category: "Small Plates",
        image:
            "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=900&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1541525985061-3a05953531fb?auto=format&fit=crop&w=900&q=80"
        ],
        tags: ["Chef's Pick"],
        modifiers: [PLATE_SIDE_GROUP],
    },
    {
        id: "sp-oysters",
        name: "Half Dozen Oysters",
        description:
            "Daily-selection oysters, mignonette, fresh lemon, chili vinegar.",
        longDescription:
            "Half dozen oysters from today's selection, served on crushed ice with classic mignonette, fresh lemon and house chili vinegar.",
        price: 180,
        category: "Small Plates",
        image:
            "https://images.unsplash.com/photo-1599813292408-0111559868e0?auto=format&fit=crop&w=900&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1599813292408-0111559868e0?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1555134731-9a7122ad39ec?auto=format&fit=crop&w=900&q=80"
        ],
        tags: ["New"],
    },
    {
        id: "sp-burrata",
        name: "Burrata & Heirloom",
        description:
            "Creamy burrata, heirloom tomatoes, basil oil, aged balsamic, sea salt.",
        longDescription:
            "Creamy Puglian burrata, sliced heirloom tomatoes, basil oil, aged balsamic and flaky sea salt. Simple, seasonal, generous.",
        price: 150,
        category: "Small Plates",
        image:
            "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
        tags: ["Vegetarian"],
        modifiers: [PLATE_SIDE_GROUP],
    },
    {
        id: "sp-truffle-fries",
        name: "Truffle Fries",
        description:
            "Hand-cut fries, truffle oil, shaved parmesan, chives, sea salt.",
        longDescription:
            "Hand-cut twice-cooked fries, tossed in truffle oil and finished with shaved parmesan, fresh chives and flaky sea salt.",
        price: 85,
        category: "Small Plates",
        image:
            "https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=900&q=80",
        tags: ["Vegetarian", "Popular"],
    },
];

export const CATEGORIES: MenuCategory[] = [
    "Signatures",
    "Spirits",
    "Wines",
    "Small Plates",
];

/** Format a number as GHS currency with thousands separators and 2 decimals. */
export function formatGHS(amount: number): string {
    return `GHS ${amount.toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
