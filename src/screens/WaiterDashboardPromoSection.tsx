import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, ArrowLeftIcon, ArrowPathIcon, Cog8ToothIcon, PlusIcon, CheckIcon } from "@heroicons/react/24/outline";
import food2Img from "../assets/food-2.jpg";
import side1Img from "../assets/side-1.jpg";

const FAKE_TABLES = [
  { id: 1, number: 1, status: "occupied", guests: 4, tabTotal: 450.00, server: "Kofi" },
  { id: 2, number: 2, status: "available" },
  { id: 3, number: 3, status: "occupied", guests: 2, tabTotal: 125.50, server: "Ama" },
  { id: 4, number: 4, status: "available" },
  { id: 5, number: 5, status: "occupied", guests: 6, tabTotal: 890.00, server: "Kofi" },
  { id: 6, number: 6, status: "available" },
];

export function WaiterDashboardPromoSection() {
  const [activeState, setActiveState] = useState(0);
  
  const block1Ref = useRef<HTMLDivElement>(null);
  const block2Ref = useRef<HTMLDivElement>(null);
  const block3Ref = useRef<HTMLDivElement>(null);
  const block4Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            setActiveState(index);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" } // trigger when block is near the center
    );

    const blocks = [block1Ref.current, block2Ref.current, block3Ref.current, block4Ref.current];
    blocks.forEach((block) => {
      if (block) observer.observe(block);
    });

    return () => {
      blocks.forEach((block) => {
        if (block) observer.unobserve(block);
      });
    };
  }, []);

  // UI components for different states
  const renderFloorMockup = () => {
    const occupiedCount = FAKE_TABLES.filter(t => t.status === "occupied").length;
    const totalTabs = FAKE_TABLES.reduce((sum, t) => sum + (t.tabTotal || 0), 0);
    const freeCount = FAKE_TABLES.length - occupiedCount;
    return (
      <div className="absolute inset-0 flex flex-col pt-5">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1a110b] rounded-full flex items-center justify-center text-[#f4f3e8] text-[11px] font-bold shadow-md">
              W
            </div>
            <span className="text-[13px] font-bold text-[#1a110b]">Waiter</span>
          </div>
          <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm">
            <div className="w-3.5 h-3.5 text-[#c9935a]">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mx-4 bg-white rounded-xl py-2.5 px-3 flex justify-between items-center shadow-sm mb-5">
           <div className="text-center flex-1">
              <p className="text-[17px] font-bold text-[#1a110b] leading-none tabular-nums">{occupiedCount}<span className="text-[11px] text-[#1a110b]/40 font-medium">/{FAKE_TABLES.length}</span></p>
              <p className="text-[7.5px] font-bold uppercase tracking-wider text-[#1a110b]/50 mt-1">occupied</p>
           </div>
           <div className="w-[1px] h-6 bg-[#1a110b]/5"></div>
           <div className="text-center flex-[1.2]">
              <p className="text-[17px] font-bold text-[#c9935a] leading-none whitespace-nowrap tabular-nums"><span className="text-[11px] text-[#c9935a]/60 font-medium">GH₵</span> {totalTabs.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              <p className="text-[7.5px] font-bold uppercase tracking-wider text-[#1a110b]/50 mt-1">open tabs</p>
           </div>
           <div className="w-[1px] h-6 bg-[#1a110b]/5"></div>
           <div className="text-center flex-1">
              <p className="text-[17px] font-bold text-[#1a110b] leading-none tabular-nums">{freeCount}</p>
              <p className="text-[7.5px] font-bold uppercase tracking-wider text-[#1a110b]/50 mt-1">free</p>
           </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 mb-5 overflow-hidden">
          <div className="bg-[#1a110b] text-[#f4f3e8] px-3.5 py-1.5 rounded-full text-[10px] font-bold shrink-0">All</div>
          <div className="bg-white text-[#1a110b] px-3.5 py-1.5 rounded-full text-[10px] font-bold shadow-sm shrink-0">Occupied</div>
          <div className="bg-white text-[#1a110b] px-3.5 py-1.5 rounded-full text-[10px] font-bold shadow-sm shrink-0">Available</div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-hidden px-4">
           <div className="grid grid-cols-2 gap-2.5 pb-6">
              {FAKE_TABLES.map(table => {
                const isOccupied = table.status === "occupied";
                return (
                <div key={table.id} className={`rounded-xl p-3.5 shadow-sm flex flex-col justify-between aspect-[1.1] ${isOccupied ? "bg-[#efebe1] border border-[#d8d3c5]" : "bg-white"}`}>
                   <div>
                     <p className="text-[8px] font-bold uppercase tracking-widest text-[#1a110b]/40 mb-0.5">Table</p>
                     <p className="text-[22px] font-bold text-[#1a110b] leading-none tabular-nums">0{table.number}</p>
                   </div>
                   <div>
                     {isOccupied ? (
                       <>
                         <p className="text-[13px] font-bold tabular-nums tracking-tight text-[#1a110b]">
                             GH₵ {table.tabTotal?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                         </p>
                         <p className="mt-0.5 text-[8px] font-semibold tracking-tight text-[#1a110b]/50 mb-1.5">
                             Served by {table.server}
                         </p>
                       </>
                     ) : (
                       <p className="text-[9.5px] font-medium text-[#1a110b]/60 mb-2 leading-tight">Ready for new guests</p>
                     )}
                     
                     <div className="flex justify-between items-center border-t border-[#1a110b]/5 pt-2">
                       <span className="text-[9px] font-bold text-[#1a110b]/40">{isOccupied ? "Manage" : "Open"}</span>
                       <ArrowRightIcon className="w-3 h-3 text-[#1a110b]/40" strokeWidth={2.5} />
                     </div>
                   </div>
                </div>
              )})}
           </div>
        </div>
      </div>
    );
  };

  // --- STATE 4: PERFORMANCE REVIEW ---
  const renderPerformanceMockup = () => {
    return (
      <div className="absolute inset-0 flex flex-col bg-[#e6e2d6] overflow-hidden no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
            <ArrowLeftIcon className="w-4 h-4 text-[#1a110b]" strokeWidth={2} />
          </div>
          <span className="text-[13px] font-bold text-[#1a110b]">My Shift</span>
          <div className="w-8 h-8"></div>
        </div>

        <div className="px-4 pb-8 space-y-4">
            {/* Hero Stats Card */}
            <div className="overflow-hidden rounded-xl bg-[#1a110b] text-[#f4f3e8] shadow-lg">
                <div className="px-5 py-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4f3e8]/60">
                        Today's Sales
                    </p>
                    <p className="mt-2 font-mono text-[32px] font-black leading-none tabular-nums">
                        <span className="text-xl font-bold opacity-75">GH₵</span> 3,240.50
                    </p>
                    <p className="mt-2 text-[10.5px] font-medium tracking-tight text-[#f4f3e8]/60">
                        Settled payments on your bills this shift
                    </p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white p-5 flex flex-col items-center justify-center text-center shadow-sm">
                    <p className="font-mono text-[18px] font-black tabular-nums text-[#1a110b]">18</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#1a110b]/50">Tables</p>
                </div>
                <div className="rounded-lg bg-white p-5 flex flex-col items-center justify-center text-center shadow-sm">
                    <p className="font-mono text-[18px] font-black tabular-nums text-[#1a110b]">
                        <span className="text-[11px] font-bold opacity-75">GH₵</span> 180.03
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#1a110b]/50">Avg Bill</p>
                </div>
                <div className="rounded-lg bg-white p-5 flex flex-col items-center justify-center text-center shadow-sm">
                    <p className="font-mono text-[18px] font-black tabular-nums text-[#1a110b]">45</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#1a110b]/50">Items</p>
                </div>
            </div>

            {/* Earnings Card */}
            <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="border-b border-[#1a110b]/5 px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9935a]">My Earnings</p>
                    <p className="mt-1 font-mono text-[24px] font-black tabular-nums text-[#1a110b]">
                        <span className="text-base font-bold opacity-75">GH₵</span> 97.22
                    </p>
                </div>
                <div className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-[11px] font-medium tracking-tight text-[#1a110b]/60">Commission (3% of sales)</span>
                    <span className="font-mono text-[12px] font-bold tabular-nums text-[#1a110b]">
                        <span className="text-[10px] font-bold opacity-75">GH₵</span> 97.22
                    </span>
                </div>
            </div>

            {/* Activity Feed */}
            <div>
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a110b]/50">Recent Activity</p>
                <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a110b]/5">
                        <div className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#c9935a]"></span>
                            <div>
                                <p className="text-[11.5px] font-bold tracking-tight text-[#1a110b]">Table 12 Settled</p>
                                <p className="text-[9.5px] font-semibold tracking-tight text-[#1a110b]/50">21m ago</p>
                            </div>
                        </div>
                        <span className="font-mono text-[12px] font-black tabular-nums text-[#1a110b]">
                            <span className="text-[10px] font-bold opacity-75">GH₵</span> 350.00
                        </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a110b]/5">
                        <div className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1a110b]/40"></span>
                            <div>
                                <p className="text-[11.5px] font-bold tracking-tight text-[#1a110b]">Table 04 Merged</p>
                                <p className="text-[9.5px] font-semibold tracking-tight text-[#1a110b]/50">34m ago</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1a110b]"></span>
                            <div>
                                <p className="text-[11.5px] font-bold tracking-tight text-[#1a110b]">Tip from Table 08</p>
                                <p className="text-[9.5px] font-semibold tracking-tight text-[#1a110b]/50">1h ago</p>
                            </div>
                        </div>
                        <span className="font-mono text-[12px] font-black tabular-nums text-[#1a110b]">
                            <span className="text-[10px] font-bold opacity-75">GH₵</span> 50.00
                        </span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  };



  const renderOrderEntryMockup = () => {
    return (
      <div className="absolute inset-0 bg-[#f4f3e8] font-sans text-licorice flex flex-col pb-6">
        {/* Header */}
        <header className="px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-licorice/8">
                    <ArrowLeftIcon className="h-4 w-4 text-licorice" strokeWidth={2.25} />
                </div>
                <span className="text-[13px] font-bold tracking-tight text-licorice">Table 01</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-licorice/8">
                    <Cog8ToothIcon className="h-4 w-4 text-licorice" strokeWidth={2.25} />
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-licorice/8">
                <div className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[#1a110b]/50 py-2 text-[11px] font-bold tracking-tight text-center">
                    Current Order <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1a110b]/10 text-[9px]">2</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-[#1a110b] text-[#f4f3e8] py-2 text-[11px] font-bold tracking-tight text-center shadow-[0_4px_12px_rgba(35,20,12,0.18)]">
                    Add Items <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px]">1</span>
                </div>
            </div>
        </header>

        <div className="w-full h-px bg-licorice/5 shrink-0" />

        {/* Content */}
        <div className="flex-1 px-5 pt-4 overflow-hidden no-scrollbar relative flex flex-col pb-24">
            {/* Categories */}
            <div className="flex gap-2 mb-4 shrink-0">
                <div className="rounded-full bg-[#1a110b] text-[#f4f3e8] px-3.5 py-1.5 text-[11px] font-bold tracking-tight shadow-[0_4px_12px_rgba(35,20,12,0.18)]">
                    Starters
                </div>
                <div className="rounded-full bg-white text-[#1a110b]/60 px-3.5 py-1.5 text-[11px] font-bold tracking-tight ring-1 ring-licorice/8">
                    Mains
                </div>
                <div className="rounded-full bg-white text-[#1a110b]/60 px-3.5 py-1.5 text-[11px] font-bold tracking-tight ring-1 ring-licorice/8">
                    Drinks
                </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Truffle Fries */}
                <article className="flex flex-col">
                    <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-lg bg-black/5 shadow-sm">
                        <img src="/mock-images/truffle_fries.jpg" alt="Truffle Fries" className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-3 flex flex-col px-1">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[14px] font-bold text-licorice">
                                <span className="text-[10px] font-bold opacity-75 mr-0.5">GH₵</span>85.00
                            </span>
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-900">
                                <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                        </div>
                        <h3 className="mt-1 text-[13px] font-bold leading-tight tracking-tight text-licorice">Truffle Fries</h3>
                        <p className="mt-0.5 text-[10px] text-feldgrau">Starters</p>
                    </div>
                </article>
                {/* Spicy Edamame */}
                <article className="flex flex-col">
                    <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-lg bg-black/5 shadow-sm">
                        <img src="/mock-images/spicy_edamame.jpg" alt="Spicy Edamame" className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-3 flex flex-col px-1">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[14px] font-bold text-licorice">
                                <span className="text-[10px] font-bold opacity-75 mr-0.5">GH₵</span>65.00
                            </span>
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-900">
                                <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                        </div>
                        <h3 className="mt-1 text-[13px] font-bold leading-tight tracking-tight text-licorice">Spicy Edamame</h3>
                        <p className="mt-0.5 text-[10px] text-feldgrau">Starters</p>
                    </div>
                </article>
                {/* Wagyu Burger */}
                <article className="flex flex-col">
                    <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-lg bg-black/5 shadow-sm">
                        <img src={food2Img} alt="Wagyu Burger" className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-3 flex flex-col px-1">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[14px] font-bold text-licorice">
                                <span className="text-[10px] font-bold opacity-75 mr-0.5">GH₵</span>210.00
                            </span>
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-900">
                                <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                        </div>
                        <h3 className="mt-1 text-[13px] font-bold leading-tight tracking-tight text-licorice">Wagyu Burger</h3>
                        <p className="mt-0.5 text-[10px] text-feldgrau">Mains</p>
                    </div>
                </article>
                {/* Side Item */}
                <article className="flex flex-col">
                    <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-lg bg-black/5 shadow-sm">
                        <img src={side1Img} alt="Crispy Calamari" className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-3 flex flex-col px-1">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[14px] font-bold text-licorice">
                                <span className="text-[10px] font-bold opacity-75 mr-0.5">GH₵</span>110.00
                            </span>
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-900">
                                <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                        </div>
                        <h3 className="mt-1 text-[13px] font-bold leading-tight tracking-tight text-licorice">Crispy Calamari</h3>
                        <p className="mt-0.5 text-[10px] text-feldgrau">Starters</p>
                    </div>
                </article>
            </div>
        </div>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 inset-x-0 px-5 py-4 border-t border-licorice/5 bg-[#f4f3e8] flex justify-between items-center z-10">
            <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-feldgrau">Subtotal</span>
                <span className="font-mono text-[15px] font-black tabular-nums text-licorice">
                    <span className="text-[10px] font-bold opacity-75 mr-0.5">GH₵</span>65.00
                </span>
            </div>
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[12px] font-bold tracking-tight text-isabelline bg-licorice shadow-[0_12px_28px_rgba(35,20,12,0.20)]">
                <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                Send to Kitchen
            </div>
        </div>
      </div>
    );
  };

  const renderOperationsMockup = () => {
    return (
      <div className="absolute inset-0 bg-[#f4f3e8] font-sans text-licorice flex flex-col pt-12 pb-6">
        {/* Header */}
        <header className="px-5 pb-3">
            <div className="flex items-center justify-between mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-licorice/8">
                    <ArrowLeftIcon className="h-4 w-4 text-licorice" strokeWidth={2.25} />
                </div>
                <span className="text-[13px] font-bold tracking-tight text-licorice">Table 01</span>
                <div className="w-9" />
            </div>

            {/* Op tabs */}
            <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-licorice/8">
                <div className="flex-1 rounded-full bg-[#1a110b] text-[#f4f3e8] py-2 text-[11px] font-bold tracking-tight text-center shadow-[0_4px_12px_rgba(35,20,12,0.18)]">
                    Transfer
                </div>
                <div className="flex-1 rounded-full text-[#1a110b]/40 py-2 text-[11px] font-bold tracking-tight text-center">
                    Merge
                </div>
                <div className="flex-1 rounded-full text-[#1a110b]/40 py-2 text-[11px] font-bold tracking-tight text-center">
                    Split
                </div>
            </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-5 pt-3 overflow-y-auto no-scrollbar">
            <div className="mb-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-isabelline">
                <div className="flex items-center gap-2 mb-1.5">
                    <ArrowPathIcon className="h-4 w-4 text-[#c9935a]" strokeWidth={2} />
                    <span className="text-[12px] font-bold tracking-tight text-licorice">Transfer Tab</span>
                </div>
                <p className="text-[11px] leading-[1.5] tracking-tight text-[#1a110b]/60">
                    Move the entire open tab (<strong className="text-licorice text-[11px]">GH₵ 450.00</strong>) from Table 01 to another free table.
                </p>
            </div>

            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a110b]/50">
                Select destination
            </p>

            <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center rounded-lg py-3 bg-white text-licorice ring-1 ring-isabelline">
                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Table</span>
                    <span className="mt-0.5 text-2xl font-bold font-sans tabular-nums text-slate-900 leading-none">02</span>
                    <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-[#1a110b]/50">Free</span>
                </div>
                <div className="flex flex-col items-center rounded-lg py-3 bg-white text-licorice ring-1 ring-isabelline">
                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Table</span>
                    <span className="mt-0.5 text-2xl font-bold font-sans tabular-nums text-slate-900 leading-none">04</span>
                    <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-[#1a110b]/50">Free</span>
                </div>
            </div>
        </div>

        {/* Bottom Actions */}
        <div className="px-5 pt-3 flex justify-between items-center border-t border-[#1a110b]/5">
            <div className="inline-flex items-center justify-center rounded-full px-5 py-3 text-[12px] font-bold tracking-tight text-red-600 bg-[#fff5f5]">
                Close Table
            </div>
            <div className="inline-flex items-center justify-center rounded-full px-5 py-3 text-[12px] font-bold tracking-tight text-[#f4f3e8] bg-[#1a110b]/40">
                Confirm
            </div>
        </div>
      </div>
    );
  };

  return (
    <section className="w-full bg-[#f4f3e8] relative">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 relative">
          
          {/* Left Column: Narrative Track */}
          <div className="flex flex-col col-span-1 pb-24">
            
            {/* Header (optional, placed before blocks) */}
            <div className="pt-24 pb-12">
               <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#c9935a] mb-4">
                 Waiter Dashboard
               </p>
               <h2 className="text-[#1a110b] text-[32px] md:text-[42px] font-bold font-['Plus_Jakarta_Sans'] tracking-tight">
                 Four steps to a frictionless night out.
               </h2>
            </div>

            {/* Block 1 */}
            <div ref={block1Ref} data-index="0" className="min-h-screen flex flex-col justify-center max-w-md mx-auto md:mx-0 py-12 md:py-0">
               <h3 className="text-4xl font-bold text-[#1A110B] mb-4 font-['Inter']">The Floor</h3>
               <p className="text-lg text-[#1A110B]/70 font-['Inter'] leading-relaxed">
                 Instantly see the pulse of your venue. Know exactly which tables are free, occupied, or waiting for a bill. Live status updates mean your staff never has to guess where they are needed most.
               </p>
               <div className="md:hidden mt-10 relative w-full max-w-[320px] h-[580px] mx-auto bg-[#e6e2d6] rounded-[32px] overflow-hidden shadow-2xl border-[8px] border-[#e8e4d9]/50 ring-1 ring-white/50 shrink-0">
                 {renderFloorMockup()}
               </div>
            </div>
            
            {/* Block 2 */}
            <div ref={block2Ref} data-index="1" className="min-h-screen flex flex-col justify-center max-w-md mx-auto md:mx-0 py-12 md:py-0">
               <h3 className="text-4xl font-bold text-[#1A110B] mb-4 font-['Inter']">Order Entry</h3>
               <p className="text-lg text-[#1A110B]/70 font-['Inter'] leading-relaxed">
                 Built for the speed of a Friday night shift. Waitstaff can take complex orders, add modifiers, and fire tickets directly to the kitchen or bar in seconds. All from the smartphones they already have in their pockets.
               </p>
               <div className="md:hidden mt-10 relative w-full max-w-[320px] h-[580px] mx-auto bg-[#e6e2d6] rounded-[32px] overflow-hidden shadow-2xl border-[8px] border-[#e8e4d9]/50 ring-1 ring-white/50 shrink-0">
                 {renderOrderEntryMockup()}
               </div>
            </div>
            
            {/* Block 3 */}
            <div ref={block3Ref} data-index="2" className="min-h-screen flex flex-col justify-center max-w-md mx-auto md:mx-0 py-12 md:py-0">
               <h3 className="text-4xl font-bold text-[#1A110B] mb-4 font-['Inter']">Operations</h3>
               <p className="text-lg text-[#1A110B]/70 font-['Inter'] leading-relaxed">
                 Frictionless tab management. Easily merge tables for large parties, split bills on the fly, and settle payments instantly via cash, card, or Mobile Money (MoMo) without ever running back to a central till.
               </p>
               <div className="md:hidden mt-10 relative w-full max-w-[320px] h-[580px] mx-auto bg-[#e6e2d6] rounded-[32px] overflow-hidden shadow-2xl border-[8px] border-[#e8e4d9]/50 ring-1 ring-white/50 shrink-0">
                 {renderOperationsMockup()}
               </div>
            </div>
            
            {/* Block 4 */}
            <div ref={block4Ref} data-index="3" className="min-h-screen flex flex-col justify-center max-w-md mx-auto md:mx-0 py-12 md:py-0">
               <h3 className="text-4xl font-bold text-[#1A110B] mb-4 font-['Inter']">Performance Review</h3>
               <p className="text-lg text-[#1A110B]/70 font-['Inter'] leading-relaxed">
                 Empower your staff with real-time feedback. Waiters can track their own shift metrics, active tabs, and total sales, keeping them accountable and moving efficiently from clock-in to close.
               </p>
               <div className="md:hidden mt-10 relative w-full max-w-[320px] h-[580px] mx-auto bg-[#e6e2d6] rounded-[32px] overflow-hidden shadow-2xl border-[8px] border-[#e8e4d9]/50 ring-1 ring-white/50 shrink-0">
                 {renderPerformanceMockup()}
               </div>
            </div>
          </div>

          {/* Right Column: Sticky Stage */}
          <div className="hidden md:flex flex-col items-center justify-center sticky top-[60px] h-[calc(100vh-60px)] col-span-1">
             <div className="relative w-[360px] h-[640px] bg-[#e8e4d9] rounded-[40px] shadow-2xl overflow-hidden border-[8px] border-[#e8e4d9]/50 ring-1 ring-white/50 scale-[0.85] lg:scale-95 origin-center">
               {/* App Content wrapper */}
               <div className="w-full h-full bg-[#e6e2d6] rounded-[32px] flex flex-col overflow-hidden relative">
                 
                 {/* Crossfade layers */}
                 <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeState === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    {renderFloorMockup()}
                 </div>
                 <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeState === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    {renderOrderEntryMockup()}
                 </div>
                 <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeState === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    {renderOperationsMockup()}
                 </div>
                 <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${activeState === 3 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    {renderPerformanceMockup()}
                 </div>

               </div>
             </div>
          </div>

        </div>
      </div>
    </section>
  );
}
