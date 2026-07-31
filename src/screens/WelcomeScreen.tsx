import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { db } from "../lib/api";

type Props = {
  onEnter?: () => void;
  onStaffPortal?: () => void;
  onKitchenDisplay?: () => void;
  onManagerPortal?: () => void;
};

export function WelcomeScreen({
  onStaffPortal,
  onKitchenDisplay,
  onManagerPortal,
}: Props) {
  const { tableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [tableLabel, setTableLabel] = useState<string>("Table 04");
  const [venueName, setVenueName] = useState<string>("Velvet Lounge");
  const [venueSlug, setVenueSlug] = useState<string>("velvet-lounge");
  const [loadingTable, setLoadingTable] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Intake Form State
  const [guestName, setGuestName] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(4);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Fetch table and venue details on mount if tableId is provided
  useEffect(() => {
    const activeTableId = tableId;
    if (!activeTableId) return;
    let cancelled = false;
    async function fetchTable() {
      setLoadingTable(true);
      setErrorMsg(null);
      const { data, error } = await db.getTableById(activeTableId!);
      if (cancelled) return;
      if (error || !data) {
        setErrorMsg("Invalid table QR code. Please check and try again.");
        setLoadingTable(false);
        return;
      }
      setTableLabel(data.table_label);
      if (data.venues) {
        setVenueName(data.venues.name);
        setVenueSlug(data.venues.slug);
      }
      setLoadingTable(false);
    }
    fetchTable();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  // 2. Submit guest session registration
  const handleContinue = async () => {
    setErrorMsg(null);

    // Fallback demo mode if tableId or token is missing
    const activeTableId = tableId || "44444444-4444-4444-4444-444444444444";
    const activeToken = token || "table4token";
    const activeVenueSlug = tableId ? venueSlug : "velvet-lounge";

    setIsSubmitting(true);
    const { data, error } = await db.getOrCreateTableSession(
      activeVenueSlug,
      activeTableId,
      activeToken,
      guestName.trim() || "User",
      partySize,
    );
    setIsSubmitting(false);

    if (error || !data || data.length === 0) {
      setErrorMsg(
        "Verification failed: " + (error?.message || "Invalid table token"),
      );
      return;
    }

    const session = data[0];
    localStorage.setItem(
      "nightos:session",
      JSON.stringify({
        sessionId: session.session_id,
        sessionToken: session.session_token,
        billId: session.bill_id,
        venueId: session.venue_id,
        tableId: activeTableId,
        tableLabel: session.table_label,
        guestName: guestName.trim() || "User",
        partySize: partySize,
        createdAt: Date.now(),
      }),
    );

    navigate("/home");
  };

  return (
    <main className="relative min-h-svh w-full overflow-y-auto bg-[#2D1F1C] px-6 py-8 flex flex-col justify-between font-sans text-white select-none">
      {/* Ambient Background Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#C9A96E]/10 mix-blend-screen blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[#C9A96E]/5 mix-blend-screen blur-[120px]" />
      </div>

      {/* Header section */}
      <div className="relative z-10 max-w-md mx-auto w-full flex-1 flex flex-col justify-center pb-8 pt-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C9A96E] mb-6 block">
          {venueName}
        </span>

        <h1 className="text-[42px] font-light leading-[1.08] tracking-tight font-serif text-white mb-4">
          A pleasure
          <br />
          <span className="italic font-bold text-[#C9A96E]">to have you.</span>
        </h1>

        <p className="text-[14px] leading-relaxed text-[#9C8E85] font-light max-w-[280px]">
          Tell us a little about yourself so we can make your evening memorable.
        </p>
      </div>

      {/* Form Card */}
      <div className="relative z-10 max-w-md mx-auto w-full bg-[#F7F4EB] rounded-[32px] p-8 shadow-2xl text-licorice flex flex-col gap-6 ring-1 ring-black/5 animate-velvet-rise">
        {/* YOUR NAME field */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold tracking-[0.22em] text-[#9C8E85] uppercase">
            Your Name
          </label>
          <input
            type="text"
            placeholder="e.g. Ama"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="bg-transparent border-b border-[#D6CFC4] py-2 text-[20px] font-medium text-[#2D1F1C] placeholder-[#D6CFC4] focus:outline-none focus:border-[#C9A96E] transition-all"
            maxLength={20}
          />
          <span className="text-[10px] text-[#9C8E85] italic mt-0.5">
            Defaults to "User" if left blank
          </span>
        </div>

        {/* PARTY SIZE field */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold tracking-[0.22em] text-[#9C8E85] uppercase">
            Party Size
          </label>
          <div className="flex items-center justify-between bg-white rounded-[16px] border border-[#EDEAE0] px-4 py-3 h-[56px]">
            {/* Left side: icon + description */}
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-[#9C8E85]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="text-[15px] font-semibold text-[#2D1F1C]">
                {partySize} {partySize === 1 ? "guest" : "guests"}
              </span>
            </div>
            {/* Right side: stepper buttons */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setPartySize((prev) => Math.max(1, prev - 1))}
                className="h-8 w-8 rounded-full border border-[#D6CFC4] flex items-center justify-center text-[#2D1F1C] hover:bg-[#EDEAE0] active:scale-95 transition-all"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 12H4"
                  />
                </svg>
              </button>
              <span className="text-[16px] font-bold text-[#2D1F1C] w-4 text-center select-none font-mono">
                {partySize}
              </span>
              <button
                type="button"
                onClick={() => setPartySize((prev) => Math.min(20, prev + 1))}
                className="h-8 w-8 rounded-full border border-[#D6CFC4] flex items-center justify-center text-[#2D1F1C] hover:bg-[#EDEAE0] active:scale-95 transition-all"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-[#EDEAE0]" />

        {/* Live Preview Badge */}
        <div className="bg-[#EDEAE0] rounded-[16px] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#2D1F1C] text-[#C9A96E] font-serif text-[18px] font-bold flex items-center justify-center uppercase">
            {(guestName.trim() || "User")[0]}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-bold text-[#2D1F1C]">
              {guestName.trim() || "User"}
            </span>
            <span className="text-[11px] text-[#9C8E85]">
              Party of {partySize}
            </span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="button"
          disabled={isSubmitting || loadingTable}
          onClick={handleContinue}
          className="w-full bg-[#2D1F1C] hover:bg-[#402C29] disabled:bg-[#9C8E85] text-white rounded-[16px] py-4 px-6 flex items-center justify-center gap-2 font-bold text-[15px] shadow-lg active:scale-[0.98] transition-all"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Continue</span>
              <svg
                className="h-4 w-4 text-[#C9A96E]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </>
          )}
        </button>

        {/* Error / Table Label Indicator */}
        {errorMsg ? (
          <p className="text-[11px] font-semibold text-red-600 text-center animate-shake mt-1">
            {errorMsg}
          </p>
        ) : (
          <p className="text-[10px] uppercase tracking-wider text-[#9C8E85] text-center mt-1">
            Seated at {tableLabel}
          </p>
        )}
      </div>

      {/* Discreet Staff/Admin Portal Footer links */}
      <footer className="relative z-10 mt-8 text-center flex justify-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em] text-[#9C8E85]/50">
        {onStaffPortal && (
          <button
            type="button"
            onClick={onStaffPortal}
            className="hover:text-[#C9A96E] transition-colors"
          >
            Staff
          </button>
        )}
        {onKitchenDisplay && (
          <button
            type="button"
            onClick={onKitchenDisplay}
            className="hover:text-[#C9A96E] transition-colors"
          >
            Kitchen
          </button>
        )}
        {onManagerPortal && (
          <button
            type="button"
            onClick={onManagerPortal}
            className="hover:text-[#C9A96E] transition-colors"
          >
            Manager
          </button>
        )}
      </footer>
    </main>
  );
}
