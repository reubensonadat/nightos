import React from "react";

export function KitchenDisplayPromoSection() {
  return (
    <section className="w-full bg-[#f4f3e8] py-24 px-8 md:px-16 lg:px-24 flex justify-center">
      <div className="w-full max-w-6xl flex flex-col items-center">
        
        {/* Header */}
        <div className="max-w-2xl text-center mb-16">
          <p className="text-[#c9935a] font-['Inter'] font-bold text-[18px] mb-4">
            Kitchen Display
          </p>
          <h2 className="font-brand text-[35px] font-bold text-[#1a110b] leading-tight">
            From ticket to pass, without the chaos.
          </h2>
        </div>

        {/* Full-width KDS Mockup Container (Let height flow naturally) */}
        <div className="w-full shadow-2xl rounded-3xl overflow-hidden border border-[#1A110B]/5 flex flex-col bg-[#f4f3e8]">
          
          {/* Mockup Top Header */}
          <div className="bg-[#23140c] px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 bg-[#f4f3e8]/10 p-1 rounded-full">
              <button className="rounded-full px-4 py-2 text-[12px] font-bold tracking-tight bg-[#f4f3e8] text-[#23140c] shadow-sm">
                All Stations
              </button>
              <button className="rounded-full px-4 py-2 text-[12px] font-bold tracking-tight text-[#f4f3e8]/70">
                Kitchen
              </button>
              <button className="rounded-full px-4 py-2 text-[12px] font-bold tracking-tight text-[#f4f3e8]/70">
                Bar
              </button>
            </div>
          </div>

          {/* Mockup Board Area (No height limit, no overflow-hidden) */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#f4f3e8]">
            
            {/* Pending Column */}
            <div className="flex flex-col gap-3">
              {/* Column Header */}
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a423f]"></span>
                  <h2 className="text-[13px] font-bold tracking-tight text-[#23140c]">Pending</h2>
                </div>
                <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums bg-[#3a423f]/15 text-[#3a423f]">
                  1
                </span>
              </div>
              
              {/* Ticket Card */}
              <article className="flex flex-col rounded-lg bg-white shadow-[0_4px_16px_rgba(35,20,12,0.08)] ring-1 ring-[#8c1c13]/50 w-full overflow-hidden">
                <header className="flex items-center justify-between border-b border-[#f4f3e8] px-4 py-3">
                  <div className="flex flex-col items-center justify-center rounded-md bg-[#23140c] px-2.5 py-1 text-[#f4f3e8]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f4f3e8]/60">Table</span>
                    <span className="font-sans font-bold text-lg tabular-nums leading-none tracking-[-0.04em]">01</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#8c1c13] font-bold">
                    <span className="text-lg tabular-nums tracking-tight">01:30</span>
                  </div>
                </header>
                
                {/* Items Body (Standard block display, no height limits) */}
                <div className="px-4 py-4">
                  <ul className="space-y-3">
                    <li className="grid grid-cols-[28px_1fr] gap-2 items-center">
                      <span className="text-base font-medium text-slate-400 tabular-nums text-left leading-tight">2x</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-900 leading-tight tracking-tight">Velvet Sliders</p>
                        <p className="mt-0.5 flex items-center text-sm font-normal text-slate-500">Extra crispy</p>
                      </div>
                    </li>
                    <li className="grid grid-cols-[28px_1fr] gap-2 items-center">
                      <span className="text-base font-medium text-slate-400 tabular-nums text-left leading-tight">1x</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-900 leading-tight tracking-tight">Grilled Octopus</p>
                      </div>
                    </li>
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-[#f4f3e8] pt-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                    <span>3 items</span>
                  </div>
                </div>
                
                <div className="border-t border-[#f4f3e8] p-2 bg-white">
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#23140c] px-4 py-3 text-base font-bold tracking-tight text-[#f4f3e8]">
                    Start Preparing
                  </button>
                </div>
              </article>
            </div>

            {/* Preparing Column */}
            <div className="flex flex-col gap-3">
              {/* Column Header */}
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8f6a37]"></span>
                  <h2 className="text-[13px] font-bold tracking-tight text-[#23140c]">Preparing</h2>
                </div>
                <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums bg-[#8f6a37]/20 text-[#8f6a37]">
                  1
                </span>
              </div>
              
              {/* Ticket Card */}
              <article className="flex flex-col rounded-lg bg-white shadow-[0_4px_16px_rgba(35,20,12,0.08)] ring-1 ring-[#8c1c13]/50 w-full overflow-hidden">
                <header className="flex items-center justify-between border-b border-[#f4f3e8] px-4 py-3">
                  <div className="flex flex-col items-center justify-center rounded-md bg-[#23140c] px-2.5 py-1 text-[#f4f3e8]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f4f3e8]/60">Table</span>
                    <span className="font-sans font-bold text-lg tabular-nums leading-none tracking-[-0.04em]">01</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#8c1c13] font-bold">
                    <span className="text-lg tabular-nums tracking-tight">14:22</span>
                  </div>
                </header>
                
                {/* Items Body */}
                <div className="px-4 py-4">
                  <ul className="space-y-3">
                    <li className="grid grid-cols-[28px_1fr] gap-2 items-center">
                      <span className="text-base font-medium text-slate-400 tabular-nums text-left leading-tight">1x</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-900 leading-tight tracking-tight">Truffle Arancini</p>
                        <p className="mt-0.5 flex items-center text-sm font-normal text-slate-500">No onions</p>
                      </div>
                    </li>
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-[#f4f3e8] pt-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                    <span>1 item</span>
                  </div>
                </div>
                
                <div className="border-t border-[#f4f3e8] p-2 bg-white">
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#c8a97e] px-4 py-3 text-base font-bold tracking-tight text-[#23140c]">
                    Mark Ready
                  </button>
                </div>
              </article>
            </div>

            {/* Ready Column */}
            <div className="flex flex-col gap-3">
              {/* Column Header */}
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#23140c]"></span>
                  <h2 className="text-[13px] font-bold tracking-tight text-[#23140c]">Ready</h2>
                </div>
                <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums bg-[#23140c]/10 text-[#23140c]">
                  0
                </span>
              </div>
              
              {/* Empty state box */}
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#23140c]/10 px-6 py-16 text-center bg-[#f4f3e8]">
                <p className="text-base font-bold uppercase tracking-wider text-[#3a423f]/60">
                  No orders
                </p>
                <p className="mt-1 text-sm tracking-tight text-[#3a423f]/50">
                  Completed orders queue here
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Narrative Description (Centered below the mockup) */}
        <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-12">
          <h3 className="text-2xl font-bold text-[#1A110B] mb-3">
            Kitchen & Bar Order Routing
          </h3>
          <p className="text-lg text-[#1A110B]/70 leading-relaxed">
            Instantly route orders from the floor to the correct preparation stations. Food items are automatically split to the kitchen display while drinks go directly to the bar screen. Staff can track active prep times with live timers and progress tickets across columns, notifying waitstaff the moment a plate is ready for pickup.
          </p>
        </div>

      </div>
    </section>
  );
}
