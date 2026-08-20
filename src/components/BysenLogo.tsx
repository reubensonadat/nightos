import React from "react";

export type BysenLogoProps = {
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Color theme variant */
  light?: boolean;
  /** Layout mode: 'full' (icon + wordmark), 'icon' (just emblem), 'badge' */
  variant?: "full" | "icon" | "badge";
  /** Optional extra classes */
  className?: string;
  /** Optional show label flag */
  showLabel?: boolean;
};

/**
 * Clean BYSEN logo icon (black monogram emblem on clean white background).
 */
export function BysenIcon({
  size = "md",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  light?: boolean;
  className?: string;
}) {
  const sizeMap = {
    xs: "h-6 w-6 rounded-md",
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-xl",
    xl: "h-16 w-16 rounded-2xl",
  };

  const dimClass = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-white p-0.5 ring-1 ring-black/10 shadow-sm transition-transform duration-200 active:scale-95 ${dimClass} ${className}`}
    >
      <img
        src="/bysen-logo.jpg"
        alt="Bysen Logo"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

/**
 * Universal Bysen Brand Logo Component featuring clean BYSEN logo & Inter typography.
 */
export function BysenLogo({
  size = "md",
  light = false,
  variant = "full",
  className = "",
  showLabel = true,
}: BysenLogoProps) {
  const textSizeMap = {
    xs: "text-[12px] tracking-[0.14em]",
    sm: "text-[14px] tracking-[0.16em]",
    md: "text-[18px] tracking-[0.18em]",
    lg: "text-[22px] tracking-[0.2em]",
    xl: "text-[28px] tracking-[0.22em]",
  };

  const textClass = textSizeMap[size] || textSizeMap.md;

  if (variant === "icon") {
    return <BysenIcon size={size} light={light} className={className} />;
  }

  if (variant === "badge") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black shadow-sm backdrop-blur-md transition-all ${className}`}
      >
        <BysenIcon size="xs" light={light} />
        <span
          className="font-black uppercase tracking-widest text-black"
          style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        >
          BYSEN
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <BysenIcon size={size} light={light} />
      {showLabel && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-sans font-black uppercase ${textClass} ${
              light ? "text-isabelline" : "text-licorice"
            }`}
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            BYSEN
          </span>
        </div>
      )}
    </div>
  );
}

export default BysenLogo;
