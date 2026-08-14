export type ManagerSignOutModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
};

export function ManagerSignOutModal({ isOpen, onClose, onSignOut }: ManagerSignOutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl flex flex-col items-center text-center">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Sign Out?</h2>
                <p className="text-sm text-slate-500 mb-6">
                    Are you sure you want to exit the manager dashboard?
                </p>

                <div className="flex flex-col w-full gap-2">
                    {/* Terminal Action */}
                    <button 
                        onClick={onSignOut}
                        className="w-full py-3.5 rounded-xl bg-red-50 text-red-700 font-bold text-base cursor-pointer transition-colors hover:bg-red-100 active:scale-[0.98]"
                    >
                        Sign Out
                    </button>

                    {/* Dismiss Action (Safe Path) */}
                    <button 
                        onClick={onClose}
                        className="w-full py-3 text-slate-500 font-medium text-sm mt-1 cursor-pointer hover:text-slate-700 active:text-slate-800"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
