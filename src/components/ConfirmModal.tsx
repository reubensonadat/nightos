import type { ReactNode } from "react";

export type ConfirmModalProps = {
    isOpen: boolean;
    title: string;
    body: string | ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    /** true → dark-red destructive confirm; false (default) → licorice+khaki primary */
    isDanger?: boolean;
    /** swaps the visual style of confirm/cancel and places cancel on top */
    swapButtons?: boolean;
    /** disables the confirm button while async work is in flight */
    loading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
};

export function ConfirmModal({
    isOpen,
    title,
    body,
    confirmLabel,
    cancelLabel = "Cancel",
    isDanger = false,
    swapButtons = false,
    loading = false,
    onConfirm,
    onClose,
}: ConfirmModalProps) {
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

                {/* Content */}
                <div className="px-6 pt-5 pb-2 md:pt-6">
                    <h2 className="text-[17px] font-bold tracking-tight text-licorice">
                        {title}
                    </h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-feldgrau">
                        {body}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
                    {swapButtons ? (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="w-full rounded-full py-3.5 text-[13px] font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-40 bg-licorice text-khaki hover:bg-licorice/90"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={loading}
                                className={
                                    isDanger
                                        ? "w-full rounded-full bg-white py-3.5 text-[13px] font-bold text-dark-red ring-1 ring-dark-red/20 transition-colors hover:bg-dark-red/5 disabled:opacity-40"
                                        : "w-full rounded-full bg-white py-3.5 text-[13px] font-bold text-feldgrau ring-1 ring-licorice/8 transition-colors hover:text-licorice disabled:opacity-40"
                                }
                            >
                                {loading ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        Working...
                                    </span>
                                ) : (
                                    confirmLabel
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={loading}
                                className={
                                    isDanger
                                        ? "w-full rounded-full py-3.5 text-[13px] font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-40 bg-dark-red/10 text-dark-red hover:bg-dark-red/20"
                                        : "w-full rounded-full py-3.5 text-[13px] font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-40 bg-licorice text-khaki hover:bg-licorice/90"
                                }
                            >
                                {loading ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        Working...
                                    </span>
                                ) : (
                                    confirmLabel
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="w-full rounded-full bg-white py-3.5 text-[13px] font-bold text-feldgrau ring-1 ring-licorice/8 transition-colors hover:text-licorice disabled:opacity-40"
                            >
                                {cancelLabel}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
