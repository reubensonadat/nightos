export type ManagerSignOutModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
    onSwitchToKitchen?: () => void;
    onSwitchToWaiter?: () => void;
};

export function ManagerSignOutModal({
    isOpen,
    onClose,
    onSignOut,
    onSwitchToKitchen,
    onSwitchToWaiter,
}: ManagerSignOutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 cursor-default bg-licorice/40 backdrop-blur-sm"
                aria-label="Close"
            />

            {/* Sheet */}
            <div className="relative z-10 w-full max-w-sm mx-4 md:mx-auto rounded-t-[28px] md:rounded-[1.5rem] bg-isabelline shadow-[0_-16px_48px_rgba(35,20,12,0.22)] ring-1 ring-white/60 overflow-hidden">
                {/* Handle - mobile only */}
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                    <span className="h-1 w-10 rounded-full bg-licorice/15" />
                </div>

                <div className="px-6 pt-5 pb-2 md:pt-6">
                    <h2 className="text-[17px] font-bold tracking-tight text-licorice">Switch View or Sign Out</h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                        Choose another dashboard to open or sign out of your session.
                    </p>
                </div>

                <div className="flex flex-col gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
                    {onSwitchToKitchen && (
                        <button
                            type="button"
                            onClick={() => {
                                onSwitchToKitchen();
                                onClose();
                            }}
                            className="w-full rounded-full bg-white py-3.5 text-[13px] font-bold tracking-tight text-licorice ring-1 ring-licorice/12 transition-all hover:bg-licorice/5 active:scale-[0.98]"
                        >
                            Kitchen Display
                        </button>
                    )}
                    {onSwitchToWaiter && (
                        <button
                            type="button"
                            onClick={() => {
                                onSwitchToWaiter();
                                onClose();
                            }}
                            className="w-full rounded-full bg-white py-3.5 text-[13px] font-bold tracking-tight text-licorice ring-1 ring-licorice/12 transition-all hover:bg-licorice/5 active:scale-[0.98]"
                        >
                            Waiter Dashboard
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="w-full rounded-full bg-licorice py-3.5 text-[13px] font-bold tracking-tight text-khaki transition-all hover:bg-licorice/90 active:scale-[0.98]"
                    >
                        Sign Out
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-full bg-white py-3.5 text-[13px] font-bold text-feldgrau ring-1 ring-licorice/8 transition-colors hover:text-licorice active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
