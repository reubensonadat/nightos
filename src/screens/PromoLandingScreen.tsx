import { useState, useRef } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { GuestExperienceSection } from "./GuestExperienceSection";
import { FAQSection } from "./FAQSection";
import heroImage from "../assets/hero-image.jpg";
import logoImage from "../assets/logo.png";

export function PromoLandingScreen() {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setIsScrolled(scrollContainerRef.current.scrollTop > 50);
    }
  };

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="bg-[#1a110b] font-['Inter'] text-[#f4f3e8] h-screen w-full flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar"
    >
      
      {/* Global Navigation (Full Width) */}
      <div className={`fixed top-0 left-0 w-full z-50 transition-colors duration-300 py-4 px-8 md:px-16 lg:px-24 ${
        isScrolled ? 'bg-[#1a110b] shadow-lg border-b border-white/5' : 'bg-[#1a110b]/0 border-b border-transparent'
      }`}>
        <nav className="flex items-center justify-between w-full h-[72px]">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Bysen Logo" className="w-9 h-9 object-contain" />
            <span className="font-['Plus_Jakarta_Sans'] text-[21.6px] font-semibold tracking-tight text-[#c9935a]">
              Bysen
            </span>
          </div>

          {/* Nav Links - Hidden on mobile */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="#" className="text-[14px] font-medium hover:text-white transition-colors">Platform</a>
            <a href="#" className="text-[14px] font-medium hover:text-white transition-colors">Pricing</a>
            <a href="#" className="text-[14px] font-medium hover:text-white transition-colors">Integrations</a>
            <a href="#" className="text-[14px] font-medium hover:text-white transition-colors">About</a>
            <button className="bg-[#c9935a] text-[#1a110b] px-6 py-2.5 rounded text-[14px] font-semibold hover:bg-[#d8a46b] transition-colors">
              Book a Demo
            </button>
          </div>
        </nav>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row w-full min-h-screen">
      
      {/* Left Content Column */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 pt-32 pb-16">
        
        {/* Hero Content */}
        <div className="flex flex-col justify-center max-w-[540px]">
          <h1 className="font-['Plus_Jakarta_Sans'] text-[42px] md:text-[52px] font-extrabold leading-[1.1] mb-6">
            The Operating System for Modern Venues.
          </h1>
          
          <p className="text-[17px] leading-relaxed text-[#f4f3e8]/80 mb-10">
            Frictionless QR ordering, real-time table management, and unified analyticsall from a single platform built for bars, clubs, and premium dining venues.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <button className="w-full sm:w-auto bg-[#c9935a] text-[#1a110b] px-8 py-3.5 rounded text-[15px] font-bold hover:bg-[#d8a46b] transition-colors">
              Book a Demo
            </button>
            <button className="group flex items-center gap-2 text-[18px] font-medium hover:text-white transition-colors">
              See the platform
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </div>

      {/* Right Image Column */}
      <div className="flex-1 relative min-h-[500px] md:min-h-screen">
        <img 
          src={heroImage}
          alt="Night venue atmosphere" 
          className="absolute inset-0 w-full h-full object-cover rounded-tl-3xl md:rounded-l-3xl lg:rounded-none object-center"
        />
        {/* Subtle gradient overlay to blend edges if needed */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a110b] to-transparent w-24 hidden md:block"></div>
      </div>
      </div>

      {/* Guest Experience Section */}
      <GuestExperienceSection />

      {/* FAQ Section */}
      <FAQSection />

      {/* Footer */}
      <footer className="w-full bg-[#1a110b] px-8 md:px-16 lg:px-24 py-16 border-t border-white/10 flex flex-col gap-16 mt-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12 lg:gap-24">
          {/* Brand Info */}
          <div className="flex flex-col gap-6 md:max-w-sm">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Bysen Logo" className="w-10 h-10 object-contain" />
              <span className="font-['Plus_Jakarta_Sans'] text-[24px] font-semibold tracking-tight text-[#c9935a]">
                Bysen
              </span>
            </div>
            <p className="text-[14px] text-[#f4f3e8]/70 leading-relaxed">
              The operating system built for premium hospitality
            </p>
          </div>

          {/* Links Columns */}
          <div className="flex-1 flex flex-wrap justify-between lg:justify-around gap-12">
            {/* Product */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#f4f3e8]/50 mb-1">Product</h4>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Manager Dashboard</a>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Waiter App</a>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Kitchen Display</a>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">QR Ordering</a>
            </div>

            {/* Company */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#f4f3e8]/50 mb-1">Company</h4>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">About Us</a>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Contact</a>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Book a Demo</a>
            </div>

            {/* Legal */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#f4f3e8]/50 mb-1">Legal</h4>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-[14px] text-[#f4f3e8]/80 hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13px] text-[#f4f3e8]/50">
          <p>© 2026 Bysen. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
