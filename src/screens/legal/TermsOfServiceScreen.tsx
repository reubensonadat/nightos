import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export function TermsOfServiceScreen() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Terms of Service · Bysen";
  }, []);

  const handleBookDemo = () => {
    setIsMobileMenuOpen(false);
    const message = encodeURIComponent(
      "Hello Bysen Team! I would like to book a demo for the Bysen POS & venue management app for my venue."
    );
    window.open(`https://wa.me/233548135853?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleNav = (target: string) => {
    setIsMobileMenuOpen(false);
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-[#1a110b] font-['Inter'] text-[#f4f3e8] flex flex-col antialiased selection:bg-[#c9935a]/30 selection:text-[#c9935a]">
      {/* Global Navigation (Full Width) */}
      <div className="sticky top-0 left-0 w-full z-50 bg-[#1a110b] shadow-lg border-b border-white/5 py-2 px-5 md:px-16 lg:px-24">
        <nav className="flex items-center justify-between w-full h-[60px]">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('/')}>
            <img src="/bysen-logo.jpg" alt="Bysen Logo" className="w-8 h-8 md:w-9 md:h-9 object-contain rounded-lg shadow-sm" />
            <span className="font-brand text-[18px] md:text-[21.6px] font-semibold tracking-tight text-[#c9935a]">
              Bysen
            </span>
          </div>

          {/* Hamburger Menu - Mobile only */}
          <button 
            className="lg:hidden text-[#f4f3e8] p-2 -mr-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <XMarkIcon className="w-7 h-7" strokeWidth={2} />
            ) : (
              <Bars3Icon className="w-7 h-7" strokeWidth={2} />
            )}
          </button>

          {/* Nav Links - Hidden on mobile */}
          <div className="hidden lg:flex items-center gap-7">
            <button onClick={() => handleNav('/')} className="text-[14px] font-medium hover:text-white transition-colors">
              Home
            </button>
            <button onClick={() => handleNav('/#platform')} className="text-[14px] font-medium hover:text-white transition-colors">
              Platform
            </button>
            <button onClick={() => handleNav('/#pricing')} className="text-[14px] font-medium hover:text-white transition-colors">
              Pricing
            </button>
            <button onClick={() => handleNav('/#faq')} className="text-[14px] font-medium hover:text-white transition-colors">
              FAQ
            </button>
            <button onClick={() => handleNav('/#about')} className="text-[14px] font-medium hover:text-white transition-colors">
              About
            </button>
            <button
              onClick={() => handleNav('/login')}
              className="text-[14px] font-semibold text-[#c9935a] hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleBookDemo}
              className="bg-[#c9935a] text-[#1a110b] px-6 py-2.5 rounded text-[14px] font-semibold hover:bg-[#d8a46b] transition-colors active:scale-95 shadow-sm"
            >
              Book a Demo
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        <div className={`lg:hidden absolute top-full left-0 w-full bg-[#1a110b] border-t border-white/5 shadow-2xl py-6 px-5 flex flex-col gap-5 transition-all duration-300 ease-in-out ${
          isMobileMenuOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}>
          <button onClick={() => handleNav('/')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            Home
          </button>
          <button onClick={() => handleNav('/#platform')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            Platform
          </button>
          <button onClick={() => handleNav('/#pricing')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            Pricing
          </button>
          <button onClick={() => handleNav('/#faq')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            FAQ
          </button>
          <button onClick={() => handleNav('/#about')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            About
          </button>
          <button
            onClick={() => handleNav('/login')}
            className="w-full py-3 text-center rounded text-[15px] font-semibold border border-[#c9935a]/30 text-[#c9935a] hover:bg-[#c9935a]/10 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={handleBookDemo}
            className="bg-[#c9935a] text-[#1a110b] w-full py-3 rounded text-[15px] font-semibold hover:bg-[#d8a46b] transition-colors active:scale-95"
          >
            Book a Demo
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 md:px-12 py-12 md:py-20">
        <div className="mb-12 border-b border-white/10 pb-8 text-left">
          <span className="inline-block rounded-full bg-[#c9935a]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#c9935a]">
            Legal &amp; Terms
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Bysen Venue Terms of Service
          </h1>
          <p className="mt-3 text-sm text-[#f4f3e8]/60">
            Last Updated: September 23, 2026
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[#f4f3e8]/80">
            These Terms of Service (&quot;Terms&quot;) govern the access and use of the Bysen point-of-sale and venue management software (&quot;Platform&quot;) provided by Bysen (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) to the subscribing venue (&quot;Venue,&quot; &quot;you,&quot; or &quot;your&quot;). By accessing or using Bysen, you agree to these Terms, including the Bysen Privacy Policy, which is incorporated into these Terms by reference.
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-[#f4f3e8]/80">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">1. Scope of Service &amp; Venue Responsibilities</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-white">Description of Service:</strong> Bysen is a modern hospitality management software providing electronic menu display, table QR ordering, real-time ticket transmission, staff assignment, bill calculation, and payment gateway facilitation for licensed food and beverage establishments.
              </p>
              <div>
                <p><strong className="text-white">Venue Account Responsibilities:</strong> The Venue and its authorized managers agree to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1 text-[#f4f3e8]/75">
                  <li>Maintain accurate menu pricing, VAT, and service charge rates in accordance with applicable tax regulations.</li>
                  <li>Safeguard manager login credentials and staff PINs against unauthorized disclosure.</li>
                  <li>Fulfill food and beverage orders placed and paid for by customers through the system.</li>
                </ul>
              </div>
              <p>
                <strong className="text-white">Onboarding &amp; Setup:</strong> Bysen provides standard instructional videos to allow the Venue to independently set up the Platform at no additional cost. If the Venue requests hands-on setup, a one-time setup fee will be invoiced based on Bysen’s then-current setup rate card, provided in writing before the work begins.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">2. Pricing, Payouts, and Transaction Fees</h2>
            <div className="space-y-3">
              <div>
                <p>
                  <strong className="text-white">Revenue Model &amp; Platform Fees:</strong> Bysen does not charge recurring monthly software subscription fees. Instead, Bysen charges a tiered platform fee per transaction based on the total transaction amount. The Bysen platform fee is structured as follows:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1 text-[#f4f3e8]/75 font-mono text-[13.5px]">
                  <li>Transactions between 0.00 GHS and 50.00 GHS: 1.00 GHS</li>
                  <li>Transactions between 51.00 GHS and 100.00 GHS: 2.00 GHS</li>
                  <li>Transactions between 101.00 GHS and 150.00 GHS: 3.00 GHS</li>
                  <li>Transactions between 151.00 GHS and 200.00 GHS: 4.00 GHS</li>
                  <li>Transactions over 200.00 GHS: 5.00 GHS</li>
                </ul>
              </div>
              <p>
                <strong className="text-white">Digital Payment Processing Fees:</strong> For digital payments processed via Paystack, Paystack currently charges a separate 2% payment processing fee. The total deduction per digital transaction will consist of Paystack’s 2% fee plus the applicable Bysen tiered platform fee outlined above.
              </p>
              <p>
                <strong className="text-white">Third-Party Rate Changes:</strong> If Paystack adjusts its processing fees, the total deduction from digital transactions will automatically adjust to reflect Paystack’s new rate. Bysen will provide at least 30 days’ written notice before any change to the Bysen tiered platform fees takes effect.
              </p>
              <p>
                <strong className="text-white">Fund Handling &amp; Settlement:</strong> All settlements and payouts are made directly to the Venue operator’s designated bank account or registered mobile money wallet. Bysen does not hold, touch, or manage the Venue’s funds. Paystack routes the applicable fees and disburses the remaining funds directly to the Venue based on their processing timelines.
              </p>
              <p>
                <strong className="text-white">Cash Transactions and Invoicing:</strong> For transactions processed in physical cash and logged into the Platform, only the applicable Bysen tiered platform fee applies. These fees will be billed to the Venue via a monthly invoice. This invoice is subject to a 5-day grace period, after which platform access may be restricted until payment is resolved. Bysen reserves the right to audit cash transaction logs against sales records.
              </p>
              <p>
                <strong className="text-white">Refunds, Disputes, and Chargebacks:</strong> Refund requests are handled by the Venue directly. Chargebacks and payment disputes initiated through Paystack are governed by Paystack’s own dispute process. Bysen will provide transaction records to support a Venue’s response but is not a party to the dispute.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">3. Hardware and Equipment</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-white">Bring Your Own Device (BYOD):</strong> Bysen is exclusively a software provider. We do not supply, lease, or maintain any physical hardware, including tablets, laptops, phones, or printers.
              </p>
              <p>
                <strong className="text-white">Hardware Liability:</strong> The Venue is entirely responsible for procuring, maintaining, and replacing their own operational devices.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">4. Term, Cancellation, and Data Retrieval</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-white">Contract Term:</strong> There is no minimum lock-in period. Use of the Platform operates on an at-will basis.
              </p>
              <p>
                <strong className="text-white">Cancellation Notice &amp; Final Billing:</strong> Either party may terminate this agreement by providing a minimum of one week (7 days) written notice. Bysen will immediately issue a final invoice for any outstanding cash transaction fees incurred up to that date, which must be paid prior to termination.
              </p>
              <p>
                <strong className="text-white">Termination for Cause:</strong> Bysen may suspend or terminate a Venue’s access immediately in cases of suspected fraud, illegal use of the Platform, or material breach of these Terms.
              </p>
              <p>
                <strong className="text-white">Data Export:</strong> Upon cancellation, the Venue may request a comprehensive copy of their sales records, and Bysen will provide it within 30 days, regardless of outstanding balance. Unpaid invoices remain separately due and collectible.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">5. Service Availability &amp; Limitation of Liability</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-white">Uptime Not Guaranteed:</strong> We strive for 99.9% uptime. However, the Platform relies on third-party cloud servers and infrastructure, and we do not guarantee continuous access.
              </p>
              <p>
                <strong className="text-white">Internet Dependency &amp; Interruptions:</strong> The Platform requires an active internet connection to function. Bysen shall not be liable for local internet outages, venue power cuts, third-party telecom disruptions affecting mobile networks, or any localized network failures at the Venue.
              </p>
              <p>
                <strong className="text-white">Limitation of Liability:</strong> Except for claims arising from fraud or willful misconduct, Bysen’s total liability under these Terms is limited to the total fees paid by the Venue to Bysen in the three (3) months preceding the claim.
              </p>
              <p>
                <strong className="text-white">Force Majeure:</strong> Neither party is liable for delay or failure to perform caused by events beyond its reasonable control, including natural disasters or government action.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">6. Patron Ordering &amp; Conduct</h2>
            <p>
              Guests scanning table QR codes agree to place genuine orders. Orders sent to the kitchen constitute a binding request for service at the Venue. Any abuse of table ordering or fraudulent chargebacks initiated by a patron may result in blacklisting and legal action pursued directly by the Venue.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">7. Privacy and Compliance</h2>
            <p>
              The Venue agrees to comply with the Bysen Privacy Policy and all applicable data protection law, including the Data Protection Act, 2012 (Act 843), in its use of Patron data obtained through the Platform. The Venue agrees to indemnify Bysen against any claim, fine, or loss arising from the Venue’s unlawful use of Patron data.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">8. Intellectual Property</h2>
            <p>
              Bysen retains all rights, title, and interest in the Platform, including its software, design, and underlying technology. The Venue retains ownership of its own business data and content entered into the Platform.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">9. Confidentiality</h2>
            <p>
              Each party agrees to keep confidential any non-public business, technical, or financial information disclosed by the other party, and to use it only to perform its obligations under this agreement.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">10. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms are governed by the laws of the Republic of Ghana. Any dispute will first be addressed through good-faith negotiation, and if unresolved within 30 days, may be referred to arbitration in Accra under the Alternative Dispute Resolution Act, 2010 (Act 798).
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">11. General Provisions</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-white">Currency:</strong> All fees are stated and payable in Ghana Cedis (GHS) unless otherwise agreed.
              </p>
              <p>
                <strong className="text-white">Assignment:</strong> Neither party may assign these Terms without written consent, except that Bysen may assign them in connection with a merger, acquisition, or sale of assets.
              </p>
              <p>
                <strong className="text-white">Entire Agreement:</strong> These Terms and the Privacy Policy constitute the entire agreement between the parties regarding the Platform.
              </p>
              <p>
                <strong className="text-white">Contact:</strong> For legal inquiries, dispute resolution, or support, please contact us at <a href="mailto:nightosst@gmail.com" className="text-[#c9935a] hover:underline font-mono">nightosst@gmail.com</a>.
              </p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#1a110b] py-8 text-center text-xs text-[#f4f3e8]/40">
        <p>© {new Date().getFullYear()} Bysen. All rights reserved.</p>
      </footer>
    </div>
  );
}
