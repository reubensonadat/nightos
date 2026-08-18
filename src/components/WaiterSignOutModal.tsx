export type WaiterSignOutModalProps = {
    isOpen: boolean;
    pendingTicketsCount: number;
    onClose: () => void;
    onSignOut: () => void;
};

export function WaiterSignOutModal({ isOpen, pendingTicketsCount, onClose, onSignOut }: WaiterSignOutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center text-center">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Active Orders Pending</h2>
                <p className="text-sm text-slate-500 mb-6 px-4">
                    You currently have <span className="font-bold text-slate-900">{pendingTicketsCount} ticket{pendingTicketsCount !== 1 && 's'}</span> in the kitchen. Are you sure you want to leave?
                </p>

                <div className="flex flex-col w-full gap-3">
                    {/* Primary Action (Safe Path) */}
                    <button 
                        onClick={onClose}
                        className="w-full py-3.5 rounded-xl bg-[#2A1A17] text-white font-bold text-base cursor-pointer transition-colors hover:bg-licorice/90 active:scale-[0.98]"
                    >
                        Stay and Complete
                    </button>

                    {/* Terminal Action (Destructive Path) */}
                    <button 
                        onClick={onSignOut}
                        className="w-full py-3.5 rounded-xl bg-red-50 text-red-700 font-bold text-base cursor-pointer transition-colors hover:bg-red-100 active:scale-[0.98]"
                    >
                        Sign Out Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}
