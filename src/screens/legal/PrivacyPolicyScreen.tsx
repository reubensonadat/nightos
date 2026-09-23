import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function PrivacyPolicyScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy Policy · Bysen";
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
            Legal & Compliance
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-[#f4f3e8]/60">
            Last updated: September 23, 2026 · Effective immediately
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-[#f4f3e8]/80">
          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">1. Introduction</h2>
            <p>
              Bysen (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a cloud-based point-of-sale, QR table-ordering, and operational platform for hospitality venues including restaurants, bars, lounges, and clubs. We are committed to protecting the privacy, accuracy, and security of all personal data processed through our software, in accordance with applicable data protection laws including the Ghana Data Protection Act, 2012 (Act 843).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">
              Depending on whether you are a venue operator, staff member, or a dining guest, we collect:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
              <li>
                <strong className="text-white">Venue Operators & Staff:</strong> Account names, email addresses, phone numbers, venue roles, and operational shift records required for staff authentication and PIN access.
              </li>
              <li>
                <strong className="text-white">Dining Guests:</strong> Table session identifiers, items ordered, order notes, optional contact phone numbers for digital receipt delivery, and reservation details.
              </li>
              <li>
                <strong className="text-white">Payment Data:</strong> All digital transactions (Mobile Money and Card payments) are processed securely through certified payment gateways (Paystack). Bysen does not store your complete card numbers, PINs, or Mobile Money authorization codes on our servers.
              </li>
              <li>
                <strong className="text-white">Device & Usage Analytics:</strong> IP addresses, browser type, device information, and interaction logs necessary to maintain system stability, security, and performance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We process data solely for legitimate operational purposes:</p>
            <ul className="list-disc pl-6 space-y-2 text-[#f4f3e8]/75">
              <li>Transmitting guest orders directly to kitchen displays and waiter terminals in real time.</li>
              <li>Facilitating bill settlement, order status tracking, and table turnover management.</li>
              <li>Generating accurate shift reports, sales analytics, and accounting summaries for venue managers.</li>
              <li>Detecting fraudulent activity and ensuring payment integrity via cryptographically verified webhooks.</li>
              <li>Providing customer support and platform updates.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">4. Data Sharing & Third Parties</h2>
            <p>
              We do not sell, rent, or trade your personal information. Data is only shared with authorized sub-processors necessary to run the service:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3 text-[#f4f3e8]/75">
              <li><strong className="text-white">Payment Processors:</strong> Paystack Payments Ltd for processing Ghana Mobile Money (MTN, Telecel, AT) and debit/credit cards.</li>
              <li><strong className="text-white">Cloud Infrastructure:</strong> Supabase and Cloudflare for secure database hosting, encrypted realtime subscriptions, and DDoS protection.</li>
              <li><strong className="text-white">Venue Managers:</strong> When you place an order at a specific venue, the venue operator and authorized staff receive your order details to prepare and serve your items.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">5. Data Retention & Security</h2>
            <p>
              We employ strict industry-standard technical measures including TLS 1.3 encryption in transit, row-level database security (RLS), and partitioned session isolation so that guests and staff only access data relevant to their specific venue and table. Session tokens for anonymous dining guests automatically expire once bills are settled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">6. Your Rights</h2>
            <p>
              Under applicable data protection laws, you have the right to request access to, correction of, or deletion of your personal data. Venue owners can export or delete their venue records by contacting support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-white mb-3">7. Contact & Support</h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your rights, please reach out to our team:
            </p>
            <div className="mt-4 rounded-xl bg-white/5 p-4 border border-white/10 space-y-1">
              <p><strong className="text-white">Bysen Operations & Support</strong></p>
              <p>Direct Contact & WhatsApp: <a href="https://wa.me/233548135853" target="_blank" rel="noopener noreferrer" className="text-[#c9935a] hover:underline font-mono">+233 54 813 5853</a></p>
              <p>Email: <span className="font-mono text-[#c9935a]">support@bysen.app</span></p>
              <p>Location: Accra, Ghana</p>
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
