import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function WelcomeScreen() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [partySize, setPartySize] = useState(4);

    return (
        <main className="min-h-svh w-full bg-[#23140C] font-sans text-[#FBF7F2] px-6 py-12 flex flex-col justify-center">
            {/* Header */}
            <div className="mb-10">
                <p className="text-[#C6A477] text-[11px] font-semibold tracking-[0.2em] uppercase mb-5">
                    Velvet Lounge
                </p>
                <h1 className="text-[44px] leading-[1.05] font-serif font-normal">
                    A pleasure<br />
                    <span className="italic text-[#C6A477]">to have you.</span>
                </h1>
                <p className="mt-5 text-[15px] text-[#FBF7F2]/70 leading-[1.5] max-w-xs">
                    Tell us a little about yourself so we can make your evening memorable.
                </p>
            </div>

            {/* Form Card */}
            <div className="bg-[#F5F2EB] rounded-[28px] p-6 text-[#23140C]">
                
                {/* YOUR NAME */}
                <div className="mb-7">
                    <label className="block text-[10px] font-bold tracking-[0.18em] text-[#908A7C] uppercase mb-4">
                        Your Name
                    </label>
                    <input 
                        type="text" 
                        placeholder="e.g. Ama" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-[#DFDBCF] pb-2 text-[22px] placeholder-[#C2BCAD] focus:outline-none focus:border-[#C6A477] transition-colors"
                    />
                    <p className="text-[12px] text-[#C6A477]/90 mt-2">
                        Defaults to "User" if left blank
                    </p>
                </div>

                {/* PARTY SIZE */}
                <div className="mb-7">
                    <label className="block text-[10px] font-bold tracking-[0.18em] text-[#908A7C] uppercase mb-4">
                        Party Size
                    </label>
                    <div className="flex items-center justify-between border border-[#DFDBCF] rounded-[18px] p-4 bg-white">
                        <div className="flex items-center gap-2.5">
                            {/* User group icon */}
                            <svg className="w-5 h-5 text-[#C6A477]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className="text-[15px] font-medium">{partySize} guests</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setPartySize(Math.max(1, partySize - 1))} 
                                className="w-8 h-8 rounded-full border border-[#DFDBCF] flex items-center justify-center text-[#908A7C] active:bg-gray-50 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg>
                            </button>
                            <span className="text-[18px] font-medium min-w-[20px] text-center">{partySize}</span>
                            <button 
                                onClick={() => setPartySize(partySize + 1)} 
                                className="w-8 h-8 rounded-full border border-[#DFDBCF] flex items-center justify-center text-[#908A7C] active:bg-gray-50 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[#DFDBCF] my-7"></div>

                {/* Summary Card */}
                <div className="bg-[#E9E4D7] rounded-xl p-3.5 flex items-center gap-3.5 mb-10">
                    <div className="w-[42px] h-[42px] shrink-0 rounded-full bg-[#23140C] flex items-center justify-center text-[#C6A477] font-serif text-[19px]">
                        {name ? name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[14.5px] font-semibold tracking-tight">{name || "User"}</span>
                        <span className="text-[13px] text-[#908A7C]">Party of {partySize}</span>
                    </div>
                </div>

                {/* Continue Button */}
                <button 
                    onClick={() => {
                        localStorage.setItem("nightos:guest", JSON.stringify({ name: name || "User", partySize }));
                        navigate("/home");
                    }}
                    className="w-full bg-[#23140C] text-[#FBF7F2] rounded-2xl py-[18px] font-medium text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                    Continue
                    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </main>
    );
}

