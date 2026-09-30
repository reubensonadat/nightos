import React from 'react';

type Props = {
  message?: string;
  className?: string;
};

export function LoadingScreen({ message = "LOADING BYSEN...", className = "" }: Props) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0D0907] text-[#C9A96E] font-sans select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle warm glow */}
        <div className="absolute h-16 w-16 rounded-full bg-[#C9A96E]/10 blur-md" />
        {/* Deep luxury gold spinner */}
        <div className="h-12 w-12 rounded-full border-3 border-[#C9A96E]/20 border-t-[#C9A96E] animate-spin" />
      </div>
      <p className="mt-5 text-[12px] font-bold tracking-[0.25em] uppercase text-[#C9A96E]/80 antialiased">
        {message}
      </p>
    </div>
  );
}
