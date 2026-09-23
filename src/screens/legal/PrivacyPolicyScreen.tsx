import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export function PrivacyPolicyScreen() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy Policy · Bysen";
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
            Legal &amp; Compliance
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Bysen Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-[#f4f3e8]/60">
            Last Updated: September 23, 2026
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-[#f4f3e8]/80">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">1. Introduction &amp; Roles</h2>
            <div className="space-y-3">
              <p>
                Bysen (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a cloud-based point-of-sale, QR table-ordering, and operational platform for hospitality venues including restaurants, bars, lounges, and clubs. This policy is governed by the Data Protection Act, 2012 (Act 843) of Ghana, and Bysen is registered as a data controller/processor with the Data Protection Commission where applicable.
              </p>
              <p className="font-semibold text-white">
                Bysen and Venues play different roles under data protection law:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
                <li>
                  <strong className="text-white">Venues are Data Controllers</strong> for Patron information collected through their point of sale. The Venue decides why data is collected and is responsible for that decision.
                </li>
                <li>
                  <strong className="text-white">Bysen is a Data Processor.</strong> We provide the software that stores and moves that data on the Venue&apos;s behalf, and we process it only according to the Venue&apos;s instructions. Bysen also acts as a controller for the limited data we collect to operate and secure the Platform itself.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">
              Depending on whether you are a venue operator, staff member, or a dining guest, we collect:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
              <li>
                <strong className="text-white">Venue Operators &amp; Staff:</strong> Account names, email addresses, phone numbers, venue roles, and operational shift records required for staff authentication and PIN access.
              </li>
              <li>
                <strong className="text-white">Dining Guests:</strong> Table session identifiers, items ordered, order notes, optional contact phone numbers for digital receipt delivery, and reservation details.
              </li>
              <li>
                <strong className="text-white">Payment Data:</strong> All digital transactions are processed securely through certified payment gateways (Paystack). Bysen does not store complete card numbers, PINs, or Mobile Money authorization codes on our servers.
              </li>
              <li>
                <strong className="text-white">Device &amp; Usage Analytics:</strong> Collected automatically through Cloudflare: IP address, device and browser type, and interaction logs necessary to maintain system stability, security, and performance.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We process data solely for legitimate operational purposes:</p>
            <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
              <li>Transmitting guest orders directly to kitchen displays and waiter terminals in real time.</li>
              <li>Facilitating bill settlement, order status tracking, and table turnover management.</li>
              <li>Generating accurate shift reports, sales analytics, and accounting summaries.</li>
              <li>Detecting fraudulent activity and ensuring payment integrity via cryptographically verified webhooks.</li>
              <li>
                <strong className="text-white">Venue Marketing Tools:</strong> Venues may use the phone numbers and transaction history generated by their own Patrons to run their own marketing campaigns. Bysen does not use Venue or Patron data to send our own marketing under any circumstance.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">4. Data Sharing &amp; Third Parties</h2>
            <p>
              We do not sell, rent, or trade your personal information. Data is only shared with authorized sub-processors necessary to run the service:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3 text-[#f4f3e8]/75">
              <li><strong className="text-white">Payment Processors:</strong> Paystack Payments Ltd for processing Ghana Mobile Money (MTN, Telecel, AT) and debit/credit cards.</li>
              <li><strong className="text-white">Cloud Infrastructure:</strong> Supabase and Cloudflare for secure database hosting, encrypted realtime subscriptions, and DDoS protection.</li>
              <li><strong className="text-white">Venue Managers:</strong> When you place an order, the venue operator and authorized staff receive your order details.</li>
            </ul>
            <p className="mt-3 text-xs text-[#f4f3e8]/60">
              Some of these providers may process data on servers located outside Ghana. Where this happens, we require contractual safeguards consistent with Act 843.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">5. Data Retention &amp; Security</h2>
            <div className="space-y-3">
              <p>
                We employ strict industry-standard technical measures including TLS 1.3 encryption in transit, row-level database security (RLS), and partitioned session isolation so that guests and staff only access data relevant to their specific venue and table. Session tokens for anonymous dining guests automatically expire once bills are settled.
              </p>
              <p>
                Transaction records are retained for 5 years to meet accounting and tax obligations.
              </p>
              <p>
                Patron marketing data is retained until the Venue deletes it, the Patron requests deletion, or the Venue account is closed.
              </p>
              <p>
                Staff account data is retained for the life of the subscription and deleted within 30 days of account closure.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">6. Patron Rights: Opt-Out and Deletion</h2>
            <p className="mb-3">
              Because Bysen does not independently store Patron emails or actively maintain external marketing databases, requests are handled as follows:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
              <li>
                <strong className="text-white">Opting out of marketing:</strong> This request goes to the Venue directly, as every Venue is required to provide a working opt-out mechanism.
              </li>
              <li>
                <strong className="text-white">Requesting deletion of your data:</strong> Direct this request to the Venue you transacted with so they can action it directly in the Platform. If you are unable to reach the Venue, contact Bysen directly and we will investigate.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">7. Children&apos;s Data</h2>
            <p>
              The Platform is intended for use by Venues serving adult Patrons. We do not knowingly collect information from anyone under 18.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">8. Contact &amp; Support</h2>
            <div className="mt-3 rounded-xl bg-white/5 p-4 border border-white/10 space-y-1">
              <p>Email: <a href="mailto:support@bysen.app" className="font-mono text-[#c9935a] hover:underline">support@bysen.app</a></p>
              <p>Direct Contact &amp; WhatsApp: <a href="https://wa.me/233548135853" target="_blank" rel="noopener noreferrer" className="text-[#c9935a] hover:underline font-mono">+233 54 813 5853</a></p>
              <p>Location: Accra, Ghana</p>
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
