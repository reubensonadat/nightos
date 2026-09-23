import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function TermsOfServiceScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Terms of Service · Bysen";
  }, []);

  return (
    <div className="min-h-screen bg-[#1a110b] font-['Inter'] text-[#f4f3e8] flex flex-col antialiased selection:bg-[#c9935a]/30 selection:text-[#c9935a]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#1a110b]/90 backdrop-blur-md px-6 md:px-16 lg:px-24 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/bysen-logo.jpg" alt="Bysen" className="h-9 w-9 rounded-lg object-contain shadow-sm" />
            <span className="font-brand text-[20px] font-semibold tracking-tight text-[#c9935a]">
              Bysen
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#f4f3e8]/80 transition-all hover:border-white/20 hover:text-white active:scale-95"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Home
            </button>
            <button
              onClick={() => navigate("/login")}
              className="rounded-lg bg-[#c9935a] px-4 py-2 text-[13px] font-bold text-[#1a110b] transition-all hover:bg-[#d8a46b] active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 md:px-12 py-12 md:py-20">
        <div className="mb-12 border-b border-white/10 pb-8">
          <span className="inline-block rounded-full bg-[#c9935a]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#c9935a]">
            Legal & Terms
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-[#f4f3e8]/60">
            Last updated: September 23, 2026 · Effective immediately
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-[#f4f3e8]/80">
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using the Bysen platform (&quot;Bysen&quot;, &quot;Service&quot;), including our QR-ordering system, waiter dashboard, kitchen display systems, and manager portal, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">2. Description of Service</h2>
            <p>
              Bysen is a modern hospitality management software providing electronic menu display, table QR ordering, real-time ticket transmission, staff assignment, bill calculation, and payment gateway facilitation for licensed food and beverage establishments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">3. Venue Account Responsibilities</h2>
            <p className="mb-3">Venue owners and authorized managers agree to:</p>
            <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
              <li>Maintain accurate menu pricing, VAT, and service charge rates in accordance with applicable tax regulations.</li>
              <li>Safeguard manager login credentials and staff PINs against unauthorized disclosure.</li>
              <li>Fulfill food and beverage orders placed and paid for by customers through the system.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">4. Payments, Settlements & Platform Fees</h2>
            <p className="mb-3">
              Payments initiated via mobile money or bank cards are processed through regulated payment partners (Paystack). Bysen applies a transparent platform convenience fee per settled transaction as configured. All settlements and payouts are made directly to the venue operator&apos;s designated bank account or registered mobile money wallet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">5. Guest Ordering & Conduct</h2>
            <p>
              Guests scanning QR codes agree to place genuine orders. Orders sent to the kitchen constitute a binding request for service at the venue. Any abuse of table ordering or fraudulent chargebacks may result in blacklisting and legal action by the venue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">6. Service Availability & Modifications</h2>
            <p>
              We strive for 99.9% uptime. However, Bysen shall not be liable for local internet outages, venue power cuts, or third-party telecom disruptions affecting mobile networks. We reserve the right to deploy updates and enhance system features at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">7. Contact & Inquiries</h2>
            <p>
              For legal inquiries, dispute resolution, or support, please contact us:
            </p>
            <div className="mt-4 rounded-xl bg-white/5 p-4 border border-white/10 space-y-1">
              <p><strong className="text-white">Bysen Platform Operations</strong></p>
              <p>Direct Support & WhatsApp: <a href="https://wa.me/233548135853" target="_blank" rel="noopener noreferrer" className="text-[#c9935a] hover:underline font-mono">+233 54 813 5853</a></p>
              <p>Email: <span className="font-mono text-[#c9935a]">legal@bysen.app</span></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#1a110b] py-8 text-center text-xs text-[#f4f3e8]/40">
        <p>© 2026 Bysen. All rights reserved.</p>
      </footer>
    </div>
  );
}
