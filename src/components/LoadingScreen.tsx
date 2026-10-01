import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

type Props = {
  venueName?: string;
  message?: string;
  className?: string;
};

function isValidName(val?: string | null): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed !== "" &&
    trimmed !== "null" &&
    trimmed !== "undefined" &&
    trimmed !== "Your Venue"
  );
}

export function LoadingScreen({ venueName, message = "Loading", className = "" }: Props) {
  let authVenueName: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    authVenueName = auth.venue?.name || auth.staffSession?.venue_name;
  } catch {
    // safely ignore if called outside AuthProvider
  }

  const resolvedName = useMemo(() => {
    if (isValidName(venueName)) return venueName.trim();
    if (isValidName(authVenueName)) return authVenueName.trim();

    // Check stored active venue name
    try {
      const stored = localStorage.getItem("nightos:active_venue_name");
      if (isValidName(stored)) return stored.trim();
    } catch {
      // ignore
    }

    // Try extracting from URL slug: /v/memories-night-club/...
    const match = window.location.pathname.match(/^\/v\/([^/]+)/);
    if (match && match[1]) {
      const raw = match[1].replace(/[-_]/g, " ");
      const formatted = raw.replace(/\b\w/g, (c) => c.toUpperCase());
      if (isValidName(formatted)) return formatted;
    }

    return "Bysen";
  }, [venueName, authVenueName]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F3F3E3] text-[#23140C] font-sans select-none antialiased ${className}`}
      style={{ backgroundColor: '#F3F3E3', color: '#23140C' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center text-center px-6 animate-brand-scale-in">
        {/* Large Bold Venue Title */}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-black tracking-wider text-[#23140C] uppercase">
          {resolvedName}
        </h1>

        {/* 5-Dot Wave Animation & Loading Status */}
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-[#23140C] animate-dot-wave"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#606F69]">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
