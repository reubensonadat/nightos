export type WaiterSignOutModalProps = {
    isOpen: boolean;
    pendingTicketsCount: number;
    onClose: () => void;
    onSignOut: () => void;
};

export function WaiterSignOutModal({ isOpen, pendingTicketsCount, onClose, onSignOut }: WaiterSignOutModalProps) {
    if (!isOpen) return null;

    const hasPending = pendingTicketsCount > 0;

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
                    <h2 className="text-[17px] font-bold tracking-tight text-licorice">
                        {hasPending ? "Active orders pending" : "Sign out?"}
                    </h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                        {hasPending ? (
                            <>
                                You have{" "}
                                <span className="font-bold text-licorice">
                                    {pendingTicketsCount} ticket{pendingTicketsCount !== 1 && "s"}
                                </span>{" "}
                                still in the kitchen. Sign out anyway?
                            </>
                        ) : (
                            "You'll be taken back to the login screen."
                        )}
                    </p>
                </div>

                <div className="flex flex-col gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
                    {/* Safe path — stay */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-full bg-licorice py-3.5 text-[13px] font-bold tracking-tight text-khaki transition-all hover:bg-licorice/90 active:scale-[0.98]"
                    >
                        Stay and Complete
                    </button>

                    {/* Danger path — sign out */}
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="w-full rounded-full bg-white py-3.5 text-[13px] font-bold tracking-tight text-dark-red ring-1 ring-licorice/8 transition-all hover:bg-dark-red/5 active:scale-[0.98]"
                    >
                        Sign Out Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}
