/* ═══════════════════════════════════════════════════════════════════════════
   MANAGER DATA LAYER — Rich mock data replicating Vendly's Supabase logic
   In production, these would be fetched from your API / Supabase.
   ═══════════════════════════════════════════════════════════════════════════ */

export type OrderStatus = "PENDING" | "PREPARING" | "SERVED" | "PAID" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";
export type AlertSeverity = "warning" | "critical";

export type Order = {
    id: string;
    ref: string;
    customer_name: string;
    customer_phone?: string;
    table: string;
    total_amount: number;
    tip_amount?: number;
    status: OrderStatus;
    payment_status: PaymentStatus;
    created_at: string; // ISO
    items: OrderLine[];
    staff_name?: string;
};

export type OrderLine = {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    lineTotal: number;
    cost_price?: number; // for margin calculation
    category?: string;
};

export type Expense = {
    id: string;
    category: string;
    amount: number;
    expense_date: string; // ISO
    description: string;
};

export type StaffMember = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: "Manager" | "Waiter" | "Kitchen" | "Bartender";
    active: boolean;
    joinedAt: string;
    hourlyRate: number;
    tablesServed: number;
    totalSales: number;
    rating: number;
    shiftsThisWeek: number;
    hoursThisWeek: number;
    currentShift?: "on" | "break" | "off";
};

export type Customer = {
    id: string;
    name: string;
    phone: string;
    email?: string;
    tier: "VIP" | "Regular" | "New";
    visits: number;
    totalSpend: number;
    lastVisit: string;
    favoriteItem?: string;
    favoriteCategory?: string;
    notes?: string;
};

export type InventoryItem = {
    id: string;
    name: string;
    category: string;
    stock: number;
    reorderThreshold: number;
    unitCost: number;
    sellingPrice: number;
    available: boolean;
    lastRestocked: string;
    supplier?: string;
};

/* ────────────────────────── GENERATORS ────────────────────────── */

function rng(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = ["Nana", "Adwoa", "Kofi", "Ama", "Kojo", "Esi", "Yaw", "Akosua", "Kwame", "Akua", "Kwesi", "Efia", "Kweku", "Abena", "Yaa"];
const LAST_NAMES = ["Kwame", "Asantewaa", "Asare", "Darko", "Frempong", "Mensah", "Owusu", "Boateng", "Ankomah", "Dankwa", "Adjei", "Osei", "Agyeman"];

function randomName(): string {
    return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomPhone(): string {
    const prefixes = ["23324", "23355", "23354", "23320", "23350", "23326", "23327", "23357", "23359"];
    const rest = String(rng(1000000, 9999999));
    return `+${pick(prefixes)}${rest}`;
}

/* ────────────────────────── RICH MOCK DATA ────────────────────────── */

const NOW = new Date();
const DAY_MS = 86400000;

export const ORDERS: Order[] = Array.from({ length: 48 }, (_, i) => {
    const daysAgo = rng(0, 30);
    const created = new Date(NOW.getTime() - daysAgo * DAY_MS - rng(0, 3600000));
    const itemCount = rng(1, 5);
    const items: OrderLine[] = Array.from({ length: itemCount }, (_, j) => {
        const qty = rng(1, 3);
        const price = rng(45, 280);
        const cost = Math.round(price * (rng(25, 45) / 100)); // 25-45% cost
        return {
            id: `ol-${i}-${j}`,
            name: pick(["Velvet Old Fashioned", "Smoked Old Fashioned", "Velvet Martini", "Hibiscus Spritz", "Macallan 12", "Don Julio 1942", "Hendrick's Gin", "Chianti Riserva '19", "Sancerre Blanc '21", "Champagne Brut", "Charcuterie Board", "Half Dozen Oysters", "Burrata & Heirloom", "Truffle Fries", "Cocoa Espresso Martini", "Lamb Suya Skewers", "Beef Tataki"]),
            quantity: qty,
            unit_price: price,
            lineTotal: qty * price,
            cost_price: cost,
            category: pick(["Signatures", "Spirits", "Wines", "Small Plates"]),
        };
    });
    const total = items.reduce((s, li) => s + li.lineTotal, 0);
    const statuses: OrderStatus[] = ["PENDING", "PREPARING", "SERVED", "PAID", "CANCELLED"];
    const orderStatus: OrderStatus = i < 35 ? "PAID" : pick(statuses);
    const payStatus: PaymentStatus = orderStatus === "PAID" ? "PAID" : orderStatus === "CANCELLED" ? "REFUNDED" : "UNPAID";

    return {
        id: `ord-${100 + i}`,
        ref: `#V-${String(4200 + i).padStart(4, "0")}`,
        customer_name: i % 4 === 0 ? "Walk-in Customer" : randomName(),
        customer_phone: i % 4 === 0 ? undefined : randomPhone(),
        table: `T-${String(rng(1, 12)).padStart(2, "0")}`,
        total_amount: total,
        tip_amount: orderStatus === "PAID" ? rng(10, 50) : 0,
        status: orderStatus,
        payment_status: payStatus,
        created_at: created.toISOString(),
        items,
        staff_name: pick(["Kojo Mensah", "Ama Boateng", "Yaw Ankomah", "Esi Dankwa", ""]),
    };
}).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

export const EXPENSES: Expense[] = [
    { id: "exp-1", category: "Food & Beverage", amount: 4200, expense_date: new Date(NOW.getTime() - 1 * DAY_MS).toISOString(), description: "Weekly produce & meat order" },
    { id: "exp-2", category: "Food & Beverage", amount: 1800, expense_date: new Date(NOW.getTime() - 2 * DAY_MS).toISOString(), description: "Spirits & wine restock" },
    { id: "exp-3", category: "Staff", amount: 3200, expense_date: new Date(NOW.getTime() - 3 * DAY_MS).toISOString(), description: "Weekly payroll" },
    { id: "exp-4", category: "Overhead", amount: 2400, expense_date: new Date(NOW.getTime() - 5 * DAY_MS).toISOString(), description: "Monthly rent" },
    { id: "exp-5", category: "Utilities", amount: 850, expense_date: new Date(NOW.getTime() - 7 * DAY_MS).toISOString(), description: "Electricity & water" },
    { id: "exp-6", category: "Food & Beverage", amount: 560, expense_date: new Date(NOW.getTime() - 10 * DAY_MS).toISOString(), description: "Ice & mixers" },
    { id: "exp-7", category: "Maintenance", amount: 1200, expense_date: new Date(NOW.getTime() - 12 * DAY_MS).toISOString(), description: "Equipment repair" },
    { id: "exp-8", category: "Marketing", amount: 400, expense_date: new Date(NOW.getTime() - 14 * DAY_MS).toISOString(), description: "Social media ads" },
    { id: "exp-9", category: "Staff", amount: 1600, expense_date: new Date(NOW.getTime() - 17 * DAY_MS).toISOString(), description: "Part-time staff wages" },
    { id: "exp-10", category: "Overhead", amount: 1200, expense_date: new Date(NOW.getTime() - 20 * DAY_MS).toISOString(), description: "Insurance" },
];

export const STAFF: StaffMember[] = [
    { id: "s1", name: "Kojo Mensah", email: "kojo@velvetlounge.gh", phone: "+233 24 123 4567", role: "Waiter", active: true, joinedAt: "2024-03-15", hourlyRate: 25, tablesServed: 142, totalSales: 18450, rating: 4.8, shiftsThisWeek: 5, hoursThisWeek: 38, currentShift: "on" },
    { id: "s2", name: "Ama Boateng", email: "ama@velvetlounge.gh", phone: "+233 24 987 6543", role: "Waiter", active: true, joinedAt: "2023-11-08", hourlyRate: 30, tablesServed: 198, totalSales: 26200, rating: 4.9, shiftsThisWeek: 4, hoursThisWeek: 32, currentShift: "on" },
    { id: "s3", name: "Kwame Asante", email: "kwame@velvetlounge.gh", phone: "+233 26 555 0199", role: "Kitchen", active: true, joinedAt: "2024-01-22", hourlyRate: 28, tablesServed: 0, totalSales: 0, rating: 4.7, shiftsThisWeek: 5, hoursThisWeek: 42, currentShift: "on" },
    { id: "s4", name: "Akosua Owusu", email: "akosua@velvetlounge.gh", phone: "+233 24 444 2288", role: "Manager", active: true, joinedAt: "2023-06-10", hourlyRate: 45, tablesServed: 0, totalSales: 0, rating: 5.0, shiftsThisWeek: 6, hoursThisWeek: 48, currentShift: "on" },
    { id: "s5", name: "Yaw Ankomah", email: "yaw@velvetlounge.gh", phone: "+233 27 333 1100", role: "Waiter", active: false, joinedAt: "2024-05-01", hourlyRate: 22, tablesServed: 38, totalSales: 4120, rating: 4.4, shiftsThisWeek: 0, hoursThisWeek: 0, currentShift: "off" },
    { id: "s6", name: "Esi Dankwa", email: "esi@velvetlounge.gh", phone: "+233 24 777 9090", role: "Kitchen", active: true, joinedAt: "2024-02-14", hourlyRate: 26, tablesServed: 0, totalSales: 0, rating: 4.6, shiftsThisWeek: 4, hoursThisWeek: 34, currentShift: "break" },
    { id: "s7", name: "Kwesi Adjei", email: "kwesi@velvetlounge.gh", phone: "+233 55 123 4567", role: "Bartender", active: true, joinedAt: "2024-06-01", hourlyRate: 28, tablesServed: 0, totalSales: 18450, rating: 4.5, shiftsThisWeek: 3, hoursThisWeek: 24, currentShift: "on" },
    { id: "s8", name: "Efia Osei", email: "efia@velvetlounge.gh", phone: "+233 50 987 6543", role: "Bartender", active: true, joinedAt: "2024-07-15", hourlyRate: 26, tablesServed: 0, totalSales: 12400, rating: 4.7, shiftsThisWeek: 4, hoursThisWeek: 30, currentShift: "off" },
];

export const CUSTOMERS: Customer[] = [
    { id: "c1", name: "Nana Kwame", phone: "+233 24 100 1001", email: "nana@email.com", tier: "VIP", visits: 42, totalSpend: 12400, lastVisit: "2 days ago", favoriteItem: "Velvet Old Fashioned", favoriteCategory: "Signatures", notes: "Allergy: nuts. Prefers window seat." },
    { id: "c2", name: "Adwoa Asantewaa", phone: "+233 24 100 1002", email: "adwoa@email.com", tier: "VIP", visits: 38, totalSpend: 9800, lastVisit: "1 week ago", favoriteItem: "Cocoa Espresso Martini", favoriteCategory: "Signatures" },
    { id: "c3", name: "Kofi Asare", phone: "+233 26 100 1003", tier: "Regular", visits: 18, totalSpend: 4200, lastVisit: "3 days ago", favoriteItem: "Lamb Suya Skewers", favoriteCategory: "Small Plates" },
    { id: "c4", name: "Ama Darko", phone: "+233 24 100 1004", tier: "Regular", visits: 12, totalSpend: 2800, lastVisit: "2 weeks ago", favoriteCategory: "Wines" },
    { id: "c5", name: "Kojo Frempong", phone: "+233 27 100 1005", tier: "New", visits: 2, totalSpend: 480, lastVisit: "Yesterday", favoriteItem: "Truffle Fries" },
    { id: "c6", name: "Esi Mensah", phone: "+233 24 100 1006", email: "esi@email.com", tier: "Regular", visits: 24, totalSpend: 5600, lastVisit: "5 days ago", favoriteItem: "Hibiscus Spritz", favoriteCategory: "Signatures" },
    { id: "c7", name: "Yaw Owusu", phone: "+233 26 100 1007", tier: "New", visits: 1, totalSpend: 220, lastVisit: "1 month ago" },
    { id: "c8", name: "Akua Adjei", phone: "+233 55 100 1008", email: "akua@email.com", tier: "VIP", visits: 52, totalSpend: 16200, lastVisit: "1 day ago", favoriteItem: "Smoked Old Fashioned", favoriteCategory: "Signatures", notes: "VIP table always reserved" },
    { id: "c9", name: "Kwesi Agyeman", phone: "+233 50 100 1009", tier: "Regular", visits: 15, totalSpend: 3400, lastVisit: "4 days ago", favoriteItem: "Charcuterie Board" },
    { id: "c10", name: "Abena Osei", phone: "+233 24 100 1010", email: "abena@email.com", tier: "VIP", visits: 31, totalSpend: 8800, lastVisit: "6 days ago", favoriteItem: "Champagne Brut", favoriteCategory: "Wines" },
];

export const INVENTORY: InventoryItem[] = [
    { id: "inv-1", name: "Cocoa Espresso Liqueur", category: "Spirits", stock: 2, reorderThreshold: 5, unitCost: 65, sellingPrice: 180, available: true, lastRestocked: "2 weeks ago", supplier: "Allied Beverages" },
    { id: "inv-2", name: "Lamb Suya Skewers (portions)", category: "Food", stock: 8, reorderThreshold: 15, unitCost: 22, sellingPrice: 55, available: true, lastRestocked: "3 days ago" },
    { id: "inv-3", name: "Macallan 12 (bottle)", category: "Spirits", stock: 4, reorderThreshold: 3, unitCost: 95, sellingPrice: 220, available: true, lastRestocked: "1 week ago", supplier: "Premium Wines & Spirits" },
    { id: "inv-4", name: "Chianti Riserva (bottle)", category: "Wines", stock: 12, reorderThreshold: 6, unitCost: 72, sellingPrice: 180, available: true, lastRestocked: "5 days ago", supplier: "Vineyard Imports" },
    { id: "inv-5", name: "Fresh Oysters (dozen)", category: "Food", stock: 0, reorderThreshold: 6, unitCost: 55, sellingPrice: 180, available: false, lastRestocked: "1 day ago" },
    { id: "inv-6", name: "Burrata (case)", category: "Food", stock: 3, reorderThreshold: 4, unitCost: 28, sellingPrice: 150, available: true, lastRestocked: "2 days ago", supplier: "Dairy Fresh Co." },
    { id: "inv-7", name: "Don Julio 1942 (bottle)", category: "Spirits", stock: 2, reorderThreshold: 2, unitCost: 140, sellingPrice: 280, available: true, lastRestocked: "1 week ago", supplier: "Premium Wines & Spirits" },
    { id: "inv-8", name: "Hendrick's Gin (bottle)", category: "Spirits", stock: 7, reorderThreshold: 4, unitCost: 38, sellingPrice: 90, available: true, lastRestocked: "3 days ago" },
    { id: "inv-9", name: "Champagne Brut (bottle)", category: "Wines", stock: 10, reorderThreshold: 5, unitCost: 62, sellingPrice: 145, available: true, lastRestocked: "1 week ago", supplier: "Vineyard Imports" },
    { id: "inv-10", name: "Truffle Oil (500ml)", category: "Food", stock: 1, reorderThreshold: 3, unitCost: 18, sellingPrice: 0, available: true, lastRestocked: "2 weeks ago", supplier: "Gourmet Supplies" },
    { id: "inv-11", name: "Sancerre Blanc (bottle)", category: "Wines", stock: 6, reorderThreshold: 4, unitCost: 68, sellingPrice: 160, available: true, lastRestocked: "4 days ago" },
    { id: "inv-12", name: "Beef Tataki (portions)", category: "Food", stock: 9, reorderThreshold: 8, unitCost: 30, sellingPrice: 110, available: true, lastRestocked: "1 day ago" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   FINANCIAL COMPUTATIONS — Like Vendly's useMemo logic
   ═══════════════════════════════════════════════════════════════════════════ */

export type FinancialSummary = {
    totalRevenue: number;
    totalCost: number;
    totalTips: number;
    netProfit: number;
    profitMargin: number;
    aov: number;
    totalOrders: number;
    returnRate: number;
    hourlyDistribution: { hour: number; count: number; formatted: string }[];
    peakHourInsight: string;
    monthlyFlow: { name: string; Income: number; Expense: number; sort: number }[];
    profitByItem: { name: string; Profit: number; Revenue: number }[];
    salesQuantityByItem: { name: string; value: number }[];
    recentOrders: Order[];
};

export function computeFinancials(
    orders: Order[],
    expenses: Expense[],
    timeFilter: string,
    customStart?: string,
    customEnd?: string
): FinancialSummary {
    let filteredOrders = orders.filter((o) => o.payment_status === "PAID");
    let filteredExpenses = [...expenses];

    const now = new Date();
    let timeframeDays: number | null = null;
    if (timeFilter === "7D") timeframeDays = 7;
    else if (timeFilter === "30D") timeframeDays = 30;
    else if (timeFilter === "90D") timeframeDays = 90;
    else if (timeFilter === "1Y") timeframeDays = 365;

    if (timeFilter === "CUSTOM" && customStart && customEnd) {
        const start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        filteredOrders = filteredOrders.filter((o) => {
            const d = new Date(o.created_at);
            return d >= start && d <= end;
        });
        filteredExpenses = filteredExpenses.filter((e) => {
            const d = new Date(e.expense_date);
            return d >= start && d <= end;
        });
    } else if (timeframeDays) {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - timeframeDays);
        cutoff.setHours(0, 0, 0, 0);
        filteredOrders = filteredOrders.filter((o) => new Date(o.created_at) >= cutoff);
        filteredExpenses = filteredExpenses.filter((e) => new Date(e.expense_date) >= cutoff);
    }

    const totalLoggedExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalTips = filteredOrders.reduce((sum, o) => sum + (o.tip_amount || 0), 0);

    let totalCost = 0;
    const productStats: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};
    const monthlyDataMap: Record<string, { name: string; Income: number; Expense: number; sort: number }> = {};
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: 0,
        formatted: `${i % 12 || 12}${i < 12 ? "AM" : "PM"}`,
    }));
    const customerOrdersMap = new Map<string, number>();

    filteredOrders.forEach((o) => {
        const date = new Date(o.created_at);
        hourlyDistribution[date.getHours()].count += 1;

        if (o.customer_phone) {
            const prev = customerOrdersMap.get(o.customer_phone) || 0;
            customerOrdersMap.set(o.customer_phone, prev + 1);
        }

        let timeStr = date.toLocaleString("default", { month: "short" });
        let sortKey = date.getMonth() + date.getFullYear() * 12;

        if (timeFilter === "7D" || timeFilter === "30D" || timeFilter === "90D") {
            timeStr = date.toLocaleString("default", { month: "short", day: "numeric" });
            sortKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        } else if (timeFilter === "1Y") {
            timeStr = date.toLocaleString("default", { month: "short", year: "2-digit" });
            sortKey = date.getMonth() + date.getFullYear() * 12;
        }

        if (!monthlyDataMap[timeStr]) {
            monthlyDataMap[timeStr] = { name: timeStr, Income: 0, Expense: 0, sort: sortKey };
        }

        let orderCost = 0;

        if (o.items && o.items.length > 0) {
            o.items.forEach((item) => {
                const itemRevenue = item.lineTotal;
                const itemCost =
                    item.cost_price && item.cost_price > 0
                        ? item.cost_price * item.quantity
                        : itemRevenue * 0.70;
                const itemProfit = itemRevenue - itemCost;
                orderCost += itemCost;

                if (!productStats[item.id]) {
                    productStats[item.id] = { name: item.name, quantity: 0, revenue: 0, profit: 0 };
                }
                productStats[item.id].quantity += item.quantity;
                productStats[item.id].revenue += itemRevenue;
                productStats[item.id].profit += itemProfit;
            });
        } else {
            orderCost = o.total_amount * 0.7;
        }

        totalCost += orderCost;
        monthlyDataMap[timeStr].Income += o.total_amount;
        monthlyDataMap[timeStr].Expense += orderCost;
    });

    filteredExpenses.forEach((e) => {
        const date = new Date(e.expense_date);
        let timeStr = date.toLocaleString("default", { month: "short" });
        if (timeFilter === "7D" || timeFilter === "30D" || timeFilter === "90D") {
            timeStr = date.toLocaleString("default", { month: "short", day: "numeric" });
        } else if (timeFilter === "1Y") {
            timeStr = date.toLocaleString("default", { month: "short", year: "2-digit" });
        }
        if (monthlyDataMap[timeStr]) {
            monthlyDataMap[timeStr].Expense += e.amount;
        }
    });

    const netProfit = totalRevenue - totalCost - totalLoggedExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const aov = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

    let repeatCustomers = 0;
    customerOrdersMap.forEach((count) => {
        if (count > 1) repeatCustomers++;
    });
    const totalCustomers = customerOrdersMap.size;
    const returnRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    const peakHourObj = [...hourlyDistribution].sort((a, b) => b.count - a.count)[0];
    const peakHourInsight =
        peakHourObj && peakHourObj.count > 0
            ? `Most active around ${peakHourObj.formatted}`
            : "Not enough data yet";

    const profitByItem = Object.values(productStats)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5)
        .map((p) => ({
            name: p.name.length > 18 ? p.name.substring(0, 18) + "..." : p.name,
            Profit: p.profit,
            Revenue: p.revenue,
        }));

    const salesQuantityByItem = Object.values(productStats)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map((p) => ({
            name: p.name.length > 18 ? p.name.substring(0, 18) + "..." : p.name,
            value: p.quantity,
        }));

    const monthlyFlow = Object.values(monthlyDataMap).sort((a, b) => a.sort - b.sort);

    return {
        totalRevenue,
        totalCost,
        totalTips,
        netProfit,
        profitMargin,
        aov,
        returnRate,
        hourlyDistribution,
        peakHourInsight,
        totalOrders: filteredOrders.length,
        profitByItem,
        salesQuantityByItem,
        monthlyFlow,
        recentOrders: filteredOrders.slice(0, 5),
    };
}