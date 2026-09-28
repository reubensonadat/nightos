import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { GuestExperienceSection } from "./GuestExperienceSection";
import { FAQSection } from "./FAQSection";
import heroImage from "../assets/hero-image.jpg";
import { WaiterDashboardPromoSection } from "./WaiterDashboardPromoSection";
import { KitchenDisplayPromoSection } from "./KitchenDisplayPromoSection";
import { ManagerDashboardPromoSection } from "./ManagerDashboardPromoSection";

export function PromoLandingScreen() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setIsScrolled(scrollContainerRef.current.scrollTop > 50);
    }
  };

  const handleBookDemo = () => {
    setIsMobileMenuOpen(false);
    const message = encodeURIComponent(
      "Hello Bysen Team! I would like to book a demo for the Bysen POS & venue management app for my venue."
    );
    window.open(`https://wa.me/233548135853?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    } else if (scrollContainerRef.current) {
      const el = scrollContainerRef.current.querySelector(`#${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="bg-[#1a110b] font-['Inter'] text-[#f4f3e8] h-screen w-full flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar"
    >
      
      {/* Global Navigation (Full Width) */}
      <div className={`fixed top-0 left-0 w-full z-50 transition-colors duration-300 py-2 px-5 md:px-16 lg:px-24 ${
        isScrolled ? 'bg-[#1a110b] shadow-lg border-b border-white/5' : 'bg-[#1a110b]/0 border-b border-transparent'
      }`}>
        <nav className="flex items-center justify-between w-full h-[60px]">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
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
            <button onClick={() => scrollToSection('home')} className="text-[14px] font-medium hover:text-white transition-colors">
              Home
            </button>
            <button onClick={() => scrollToSection('platform')} className="text-[14px] font-medium hover:text-white transition-colors">
              Platform
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-[14px] font-medium hover:text-white transition-colors">
              Pricing
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-[14px] font-medium hover:text-white transition-colors">
              FAQ
            </button>
            <button onClick={() => scrollToSection('about')} className="text-[14px] font-medium hover:text-white transition-colors">
              About
            </button>
            <button
              onClick={() => navigate('/login')}
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
          <button onClick={() => scrollToSection('home')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            Home
          </button>
          <button onClick={() => scrollToSection('platform')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            Platform
          </button>
          <button onClick={() => scrollToSection('pricing')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            Pricing
          </button>
          <button onClick={() => scrollToSection('faq')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            FAQ
          </button>
          <button onClick={() => scrollToSection('about')} className="text-left text-[16px] font-medium hover:text-white transition-colors">
            About
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/login');
            }}
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

      {/* Mobile Menu Backdrop Blur Overlay */}
      <div 
        className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-md z-40 transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Hero Section */}
      <div className="relative flex flex-col md:flex-row w-full min-h-[85vh] md:min-h-screen">
      
        {/* Mobile Background Image & Overlay */}
        <div className="absolute inset-0 w-full h-full md:hidden">
          <img 
            src={heroImage}
            alt="Night venue atmosphere" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#1a110b]/80"></div>
        </div>

        {/* Left Content Column */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-16 lg:px-24 pt-28 pb-16 md:pt-32">
          <div className="flex flex-col justify-center max-w-[540px]">
            <h1 className="font-brand text-[42px] md:text-[52px] font-extrabold leading-[1.1] mb-6">
              The Operating System for Modern Venues.
            </h1>
            
            <p className="text-[17px] leading-relaxed text-[#f4f3e8]/80 mb-16">
              Frictionless QR ordering, real-time table management, and unified analytics all from a single platform built for bars, clubs, and premium dining venues.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <button
                onClick={handleBookDemo}
                className="w-full sm:w-auto bg-[#c9935a] text-[#1a110b] px-8 py-3.5 rounded text-[15px] font-bold hover:bg-[#d8a46b] transition-colors active:scale-95 shadow-md"
              >
                Book a Demo
              </button>
              <button
                onClick={() => navigate('/login')}
                className="group flex items-center gap-2 text-[18px] font-medium hover:text-[#c9935a] text-[#f4f3e8] transition-colors active:scale-95"
              >
                See the platform
                <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Image Column (Desktop only) */}
        <div className="hidden md:block flex-1 relative min-h-screen">
          <img 
            src={heroImage}
            alt="Night venue atmosphere" 
            className="absolute inset-0 w-full h-full object-cover md:rounded-l-3xl lg:rounded-none object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a110b] to-transparent w-24"></div>
        </div>
      </div>

      {/* Platform Section Container */}
      <div id="platform">
        {/* Waiter Dashboard Promo Section */}
        <WaiterDashboardPromoSection />

        {/* Kitchen Display Promo Section */}
        <KitchenDisplayPromoSection />

        {/* Manager Dashboard Promo Section */}
        <ManagerDashboardPromoSection />

        {/* Guest Experience Section */}
        <GuestExperienceSection />
      </div>

      {/* Pricing & Value Section */}
      <section id="pricing" className="w-full bg-[#140c07] px-6 md:px-16 lg:px-24 py-20 border-t border-white/5">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-[#c9935a]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#c9935a] mb-4">
            Transparent Pricing
          </span>
          <h2 className="font-brand text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Flat fees. Zero hidden surprises.
          </h2>
          <p className="mt-4 text-[16px] text-[#f4f3e8]/75 max-w-2xl mx-auto">
            Run your venue with confidence. Built for Ghanaian hospitality with flat convenience pricing per settled transaction.
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="rounded-3xl border border-[#c9935a]/30 bg-[#1a110b] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between">
              <div>
                <span className="text-[12px] font-bold uppercase tracking-widest text-[#c9935a]">Core Platform</span>
                <h3 className="mt-2 text-2xl font-black text-white">Full Operations Suite</h3>
                <p className="mt-2 text-sm text-[#f4f3e8]/70">Everything your venue needs to take orders and operate live.</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">Flat ₵1 – ₵15</span>
                  <span className="text-sm text-[#f4f3e8]/50">/ settled order</span>
                </div>
                <ul className="mt-8 space-y-3 text-sm text-[#f4f3e8]/80">
                  <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#c9935a]" /> Unlimited QR Table Codes</li>
                  <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#c9935a]" /> Real-time Kitchen Display (KDS)</li>
                  <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#c9935a]" /> Waiter PIN Login & Table Layout</li>
                  <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#c9935a]" /> Manager Shift Reports & Sales Analytics</li>
                </ul>
              </div>
              <button
                onClick={handleBookDemo}
                className="mt-8 w-full rounded-xl bg-[#c9935a] py-3.5 text-center text-sm font-bold text-[#1a110b] hover:bg-[#d8a46b] transition-all active:scale-95"
              >
                Book a Demo
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#1a110b] p-8 flex flex-col justify-between">
              <div>
                <span className="text-[12px] font-bold uppercase tracking-widest text-[#f4f3e8]/50">Payments &amp; Infrastructure</span>
                <h3 className="mt-2 text-2xl font-black text-white">Built for Ghana & Beyond</h3>
                <p className="mt-2 text-sm text-[#f4f3e8]/70">Native payment processing and hardware compatibility.</p>
                <ul className="mt-8 space-y-4 text-sm text-[#f4f3e8]/80">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    <div>
                      <strong className="text-white block">Mobile Money (MTN, Telecel, AT)</strong>
                      <span className="text-xs text-[#f4f3e8]/60">Instant payment verification directly to your payout account.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                    <div>
                      <strong className="text-white block">Visa & Mastercard</strong>
                      <span className="text-xs text-[#f4f3e8]/60">3D-Secure card payments processed via Paystack.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#c9935a] shrink-0" />
                    <div>
                      <strong className="text-white block">Realtime Synchronization</strong>
                      <span className="text-xs text-[#f4f3e8]/60">Sub-second updates between guest phones, kitchen, and managers.</span>
                    </div>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full rounded-xl border border-white/15 py-3.5 text-center text-sm font-bold text-white hover:bg-white/5 transition-all active:scale-95"
              >
                Sign In to Platform
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <div id="faq">
        <FAQSection />
      </div>

      {/* Footer / About */}
      <footer id="about" className="w-full bg-[#1a110b] px-8 md:px-16 lg:px-24 py-16 border-t border-white/10 flex flex-col gap-16 mt-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12 lg:gap-24">
          {/* Brand Info */}
          <div className="flex flex-col gap-6 md:max-w-sm">
            <div className="flex items-center gap-3">
              <img src="/bysen-logo.jpg" alt="Bysen Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" />
              <span className="font-brand text-[24px] font-semibold tracking-tight text-[#c9935a]">
                Bysen
              </span>
            </div>
            <p className="text-[14px] text-[#f4f3e8]/70 leading-relaxed">
              The operating system built for modern bars, clubs, and premium dining venues.
            </p>
            <p className="text-[13px] text-[#f4f3e8]/50">
              Direct Support: <a href="https://wa.me/233548135853" target="_blank" rel="noopener noreferrer" className="text-[#c9935a] hover:underline font-mono">+233 54 813 5853</a>
            </p>
          </div>

          {/* Links Columns */}
          <div className="flex-1 flex flex-wrap justify-between lg:justify-around gap-12">
            {/* Product */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#f4f3e8]/50 mb-1">Product</h4>
              <button onClick={() => navigate('/login')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Manager Dashboard
              </button>
              <button onClick={() => navigate('/waiter')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Waiter App
              </button>
              <button onClick={() => navigate('/kitchen')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Kitchen Display
              </button>
              <button onClick={() => navigate('/login')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                QR Ordering
              </button>
            </div>

            {/* Company */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#f4f3e8]/50 mb-1">Company</h4>
              <button onClick={() => scrollToSection('about')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                About Us
              </button>
              <button onClick={handleBookDemo} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Contact & Support
              </button>
              <button onClick={handleBookDemo} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Book a Demo
              </button>
            </div>

            {/* Legal */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#f4f3e8]/50 mb-1">Legal</h4>
              <button onClick={() => navigate('/privacy')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Privacy Policy
              </button>
              <button onClick={() => navigate('/terms')} className="text-left text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">
                Terms of Service
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13px] text-[#f4f3e8]/50">
          <p>© 2026 Bysen. All rights reserved.</p>
          <div className="flex gap-6">
            <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
