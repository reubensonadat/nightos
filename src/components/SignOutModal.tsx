type SignOutModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
    onReviewPerformance: () => void;
    tablesManaged: number;
};

export function SignOutModal({ isOpen, onClose, onSignOut, onReviewPerformance, tablesManaged }: SignOutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center text-center">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Ready to clock out?</h2>
                <p className="text-sm text-slate-500 mb-6">
                    You managed <span className="font-semibold text-slate-700">{tablesManaged} tables</span> today. Review your shift analytics before signing out?
                </p>
                <div className="flex flex-col w-full gap-3">
                    {/* Primary Exploratory Action */}
                    <button 
                        onClick={onReviewPerformance}
                        className="w-full py-3.5 rounded-xl bg-[#2A1A17] text-white font-bold text-base transition-colors active:scale-[0.98]"
                    >
                        Review Performance
                    </button>

                    {/* Terminal Action */}
                    <button 
                        onClick={onSignOut}
                        className="w-full py-3.5 rounded-xl bg-red-50 text-red-700 font-bold text-base transition-colors active:scale-[0.98]"
                    >
                        Sign Out
                    </button>

                    {/* Dismiss Action */}
                    <button 
                        onClick={onClose}
                        className="w-full py-3 text-slate-400 font-medium text-sm mt-1 active:text-slate-600"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
