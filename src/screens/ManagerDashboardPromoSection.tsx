import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  BanknotesIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

/* ── Static demo data ───────────────────────────────────────────── */

const WEEKLY_REVENUE = [
  { day: "Mon", revenue: 2840 },
  { day: "Tue", revenue: 3120 },
  { day: "Wed", revenue: 1980 },
  { day: "Thu", revenue: 4250 },
  { day: "Fri", revenue: 6800 },
  { day: "Sat", revenue: 8940 },
  { day: "Sun", revenue: 5310 },
];

const TOP_SELLERS = [
  { name: "Truffle Arancini", sold: 38, revenue: 3230 },
  { name: "Velvet Sliders", sold: 29, revenue: 2465 },
  { name: "Grilled Octopus", sold: 21, revenue: 2730 },
];

const FLOOR_TABLES = [
  { number: "01", status: "occupied", total: 450 },
  { number: "02", status: "available" },
  { number: "03", status: "occupied", total: 125 },
  { number: "04", status: "available" },
  { number: "05", status: "occupied", total: 890 },
  { number: "06", status: "occupied", total: 310 },
];

const STAFF = [
  { name: "Kofi A.", role: "Waiter", active: true },
  { name: "Ama S.", role: "Manager", active: true },
  { name: "Kwesi B.", role: "Kitchen", active: true },
  { name: "Abena M.", role: "Bartender", active: false },
];

const RECENT_ORDERS = [
  { ref: "#3021", customer: "Kwame O.", table: "Table 05", amount: 310, status: "preparing" as const },
  { ref: "#3020", customer: "Abena M.", table: "Table 03", amount: 125, status: "served" as const },
  { ref: "#3019", customer: "Yaa B.", table: "Table 01", amount: 450, status: "pending" as const },
];

const STATUS_STYLES = {
  pending:   { dot: "bg-amber-400",   text: "text-amber-700",   label: "Pending"   },
  preparing: { dot: "bg-blue-400",    text: "text-blue-700",    label: "Preparing" },
  served:    { dot: "bg-emerald-500", text: "text-emerald-700", label: "Served"    },
};

/* ── Helper ─────────────────────────────────────────────────────── */
function ghc(n: number) {
  return `GH\u20B5 ${n.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

/* ── Component ─────────────────────────────────────────────────── */

export function ManagerDashboardPromoSection() {
  return (
    <section className="w-full bg-[#f4f3e8] py-24 px-8 md:px-16 lg:px-24 flex justify-center">
      <div className="w-full max-w-6xl flex flex-col items-center">

        {/* Header */}
        <div className="max-w-2xl text-center mb-16">
          <p className="text-[#c9935a] font-[Inter] font-bold text-[18px] mb-4">
            Manager Dashboard
          </p>
          <h2 className="font-brand text-[35px] font-bold text-[#1a110b] leading-tight mb-4">
            Your venue command centre,<br />always one tap away.
          </h2>
          <p className="text-[16px] text-[#1a110b]/60 leading-relaxed">
            Revenue, floor status, staff shifts, top sellers, and alerts all on one screen.
            Make fast decisions with real numbers, not guesswork.
          </p>
        </div>

        {/* BENTO GRID */}
        <div className="w-full grid grid-cols-4 gap-4">

          {/* ROW 1 */}

          {/* Revenue Hero — 2 col */}
          <div className="col-span-4 md:col-span-2 rounded-2xl bg-[#1a110b] text-[#f4f3e8] p-6 shadow-lg flex flex-col justify-between relative overflow-hidden min-h-[200px]">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[#c9935a]/20 blur-[60px] pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <BanknotesIcon className="h-5 w-5 text-[#f4f3e8]/40" strokeWidth={1.5} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#f4f3e8]/60 mb-1">Today&apos;s Revenue</p>
              <h3 className="text-[38px] font-black tabular-nums leading-none tracking-tight">
                <span className="text-[20px] font-bold opacity-60 mr-1">GH&#8373;</span>8,940.00
              </h3>
              <p className="mt-2 text-[11px] text-[#f4f3e8]/40 tracking-tight">
                vs. GH&#8373; 6,310.00 yesterday
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-[#f4f3e8]/80">
                42 payments today
              </span>
              <span className="rounded-full bg-[#c9935a]/20 px-3 py-1.5 text-[11px] font-bold text-[#c9935a]">
                +41.7% &#8593;
              </span>
            </div>
          </div>

          {/* Open Orders — 1 col */}
          <div className="col-span-2 md:col-span-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5 flex flex-col justify-between min-h-[200px]">
            <div>
              <ShoppingCartIcon className="h-5 w-5 text-[#606f69] mb-3" strokeWidth={1.5} />
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#606f69] mb-1">Orders Being Made</p>
              <h3 className="text-[36px] font-black tabular-nums leading-none text-[#1a110b]">7</h3>
              <p className="mt-1.5 text-[11px] text-[#606f69]">in kitchen &amp; bar</p>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f4f3e8]">
              <div className="h-full w-[58%] rounded-full bg-[#c9935a] transition-all duration-500" />
            </div>
          </div>

          {/* Tables In Use — 1 col */}
          <div className="col-span-2 md:col-span-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5 flex flex-col justify-between min-h-[200px]">
            <div>
              <TableCellsIcon className="h-5 w-5 text-[#606f69] mb-3" strokeWidth={1.5} />
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#606f69] mb-1">Tables in Use</p>
              <h3 className="text-[36px] font-black tabular-nums leading-none text-[#1a110b]">
                4<span className="text-[18px] font-bold text-[#606f69]">/6</span>
              </h3>
              <p className="mt-1.5 text-[11px] text-[#606f69]">2 tables free</p>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f4f3e8]">
              <div className="h-full w-[67%] rounded-full bg-[#1a110b] transition-all duration-500" />
            </div>
          </div>

          {/* ROW 2 */}

          {/* Top Sellers — 1 col */}
          <div className="col-span-4 md:col-span-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5 flex flex-col">
            <h3 className="text-[14px] font-bold tracking-tight text-[#1a110b] mb-5">Top Sellers</h3>
            <ul className="space-y-5 flex-1">
              {TOP_SELLERS.map((item) => (
                <li key={item.name} className="flex items-center justify-between">
                  <span className="text-[13px] font-medium tracking-tight text-[#1a110b] truncate pr-3 leading-tight">
                    {item.name}
                  </span>
                  <div className="flex flex-col items-end text-right leading-none shrink-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[22px] font-black tabular-nums text-[#1a110b] tracking-tight">{item.sold}</span>
                      <span className="text-[11px] text-[#606f69]">sold</span>
                    </div>
                    <span className="text-[10px] text-[#606f69] mt-1 tabular-nums">{ghc(item.revenue)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-4 border-t border-[#f4f3e8]">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#606f69]">7-day window</span>
            </div>
          </div>

          {/* Revenue Bar Chart — 3 col */}
          <div className="col-span-4 md:col-span-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[14px] font-bold tracking-tight text-[#1a110b]">Revenue</h3>
              <div className="flex items-center gap-1 rounded-full bg-[#f4f3e8] p-0.5">
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#1a110b] text-[#f4f3e8]">7D</span>
                <span className="px-2.5 py-1 text-[11px] font-medium text-[#606f69]">30D</span>
              </div>
            </div>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEKLY_REVENUE} barGap={6}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#606F69", fontWeight: 600 }}
                    dy={8}
                  />
                  <Tooltip
                    cursor={{ fill: "#F4F3E8" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: "500",
                      padding: "8px 12px",
                    }}
                    formatter={(value: unknown) => [ghc(Number(value)), "Revenue"]}
                    labelStyle={{ display: "none" }}
                  />
                  <Bar dataKey="revenue" fill="#23140C" radius={[6, 6, 6, 6]} barSize={28} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#f4f3e8] pt-3">
              <span className="text-[11px] font-bold tracking-tight text-[#606f69]">Best day: Sat &middot; GH&#8373; 8,940.00</span>
              <span className="text-[11px] font-bold tabular-nums text-[#1a110b]">
                Total: {ghc(WEEKLY_REVENUE.reduce((s, d) => s + d.revenue, 0))}
              </span>
            </div>
          </div>

          {/* ROW 3 */}

          {/* Floor Grid — 1 col */}
          <div className="col-span-4 md:col-span-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5">
            <h3 className="text-[14px] font-bold tracking-tight text-[#1a110b] mb-4">Floor</h3>
            <div className="grid grid-cols-3 gap-2">
              {FLOOR_TABLES.map((t) => (
                <div
                  key={t.number}
                  className={`rounded-xl p-3 flex flex-col justify-between aspect-square ${
                    t.status === "occupied"
                      ? "bg-[#efebe1] border border-[#d8d3c5]"
                      : "bg-[#f4f3e8]"
                  }`}
                >
                  <p className="text-[8px] font-bold uppercase tracking-widest text-[#1a110b]/40">T</p>
                  <p className="text-[18px] font-black text-[#1a110b] leading-none tabular-nums">{t.number}</p>
                  {t.status === "occupied" ? (
                    <p className="text-[8px] font-bold tabular-nums text-[#c9935a]">
                      &#8373;{t.total}
                    </p>
                  ) : (
                    <p className="text-[8px] text-[#1a110b]/30 font-medium">Free</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Staff Snapshot — 1 col */}
          <div className="col-span-4 md:col-span-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold tracking-tight text-[#1a110b]">Staff</h3>
              <UserGroupIcon className="h-4 w-4 text-[#606f69]" strokeWidth={1.5} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl bg-[#f4f3e8] p-3 text-center">
                <p className="text-[20px] font-black tabular-nums text-[#1a110b]">3</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#606f69]">On Shift</p>
              </div>
              <div className="rounded-xl bg-[#f4f3e8] p-3 text-center">
                <p className="text-[20px] font-black tabular-nums text-[#1a110b]">4</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#606f69]">Total</p>
              </div>
            </div>
            <div className="space-y-2.5 flex-1">
              {STAFF.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.active ? "bg-emerald-500" : "bg-[#1a110b]/20"}`} />
                    <span className="text-[12px] font-medium tracking-tight text-[#1a110b]">{s.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#606f69]">{s.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders Table — 2 col */}
          <div className="col-span-4 md:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#1a110b]/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold tracking-tight text-[#1a110b]">Recent Orders</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-[#606f69] border-b border-[#f4f3e8]">
                  <th className="pb-2.5 font-bold">Order</th>
                  <th className="pb-2.5 font-bold">Guest</th>
                  <th className="pb-2.5 font-bold">Table</th>
                  <th className="pb-2.5 font-bold">Amount</th>
                  <th className="pb-2.5 font-bold hidden sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f3e8]">
                {RECENT_ORDERS.map((o) => {
                  const st = STATUS_STYLES[o.status];
                  return (
                    <tr key={o.ref} className="text-[12px]">
                      <td className="py-3 font-mono text-[#1a110b]/60 tabular-nums">{o.ref}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-[#f4f3e8] flex items-center justify-center text-[9px] font-bold text-[#606f69] uppercase shrink-0">
                            {o.customer.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="font-medium text-[#1a110b] truncate">{o.customer}</span>
                        </div>
                      </td>
                      <td className="py-3 text-[#606f69]">{o.table}</td>
                      <td className="py-3 font-bold tabular-nums text-[#1a110b]">{ghc(o.amount)}</td>
                      <td className="py-3 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          <span className={`text-[11px] font-medium ${st.text}`}>{st.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* Narrative description */}
        <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-12">
          <h3 className="text-2xl font-bold text-[#1A110B] mb-3">
            Every number that matters, right now
          </h3>
          <p className="text-lg text-[#1A110B]/70 leading-relaxed">
            The manager dashboard pulls live data from every corner of your venue: payments, open bills,
            active shifts, inventory levels, and order throughput. It surfaces everything as a clean command
            centre. Spot a slow table, a low-stock item, or a spike in revenue the moment it happens.
          </p>
        </div>

      </div>
    </section>
  );
}
