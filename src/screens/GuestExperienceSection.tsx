import { QrCodeIcon, ClipboardDocumentListIcon, CreditCardIcon } from "@heroicons/react/24/outline";

export function GuestExperienceSection() {
  return (
    <section className="w-full bg-[#f4f3e8] py-24 px-8 md:px-16 lg:px-24 flex justify-center">
      <div className="w-full max-w-6xl flex flex-col items-center">
        
        {/* Header */}
        <div className="max-w-2xl text-center mb-16">
          <p className="text-[#c9935a] font-['Inter'] font-bold text-[18px] mb-4">
            Guest Experience
          </p>
          <h2 className="font-brand text-[35px] font-bold text-[#1a110b] leading-tight">
            Three steps to a frictionless night out.
          </h2>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          
          {/* Step 1: Scan */}
          <div className="bg-white rounded-2xl p-10 flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-[#c9935a]/10 rounded-xl flex items-center justify-center mb-8 text-[#c9935a]">
              <QrCodeIcon className="w-8 h-8" />
            </div>
            <p className="text-[#c9935a] font-['Inter'] font-bold text-[11px] uppercase tracking-wider mb-2">
              Step 1: Scan
            </p>
            <h3 className="font-brand text-[22px] font-bold text-[#1a110b] mb-4">
              Scan
            </h3>
            <p className="text-[#6b5f54] font-['Inter'] text-[15px] leading-relaxed">
              Guests scan the table QR with any smartphone camera — no app download, no account required. They land directly on your branded menu.
            </p>
          </div>

          {/* Step 2: Order */}
          <div className="bg-white rounded-2xl p-10 flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-[#c9935a]/10 rounded-xl flex items-center justify-center mb-8 text-[#c9935a]">
              <ClipboardDocumentListIcon className="w-8 h-8" />
            </div>
            <p className="text-[#c9935a] font-['Inter'] font-bold text-[11px] uppercase tracking-wider mb-2">
              Step 2: Order
            </p>
            <h3 className="font-brand text-[22px] font-bold text-[#1a110b] mb-4">
              Order
            </h3>
            <p className="text-[#6b5f54] font-['Inter'] text-[15px] leading-relaxed">
              A rich, photo-led digital menu lets guests browse, customise, and add to their order at their own pace — no rushed interactions with staff.
            </p>
          </div>

          {/* Step 3: Pay */}
          <div className="bg-white rounded-2xl p-10 flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-[#c9935a]/10 rounded-xl flex items-center justify-center mb-8 text-[#c9935a]">
              <CreditCardIcon className="w-8 h-8" />
            </div>
            <p className="text-[#c9935a] font-['Inter'] font-bold text-[11px] uppercase tracking-wider mb-2">
              Step 3: Pay
            </p>
            <h3 className="font-brand text-[22px] font-bold text-[#1a110b] mb-4">
              Pay
            </h3>
            <p className="text-[#6b5f54] font-['Inter'] text-[15px] leading-relaxed">
              Guests pay by card, Apple Pay, or Google Pay directly from their phone. Receipts are instant. Your staff never touch a card machine again.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
