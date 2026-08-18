import type { ReactNode } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  disabled?: boolean;
  autoFocus?: boolean;
};

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  trailing,
  autoComplete,
  inputMode,
  disabled,
  autoFocus,
}: TextFieldProps) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">{label}</label>
      <div className="mt-1.5 flex h-11 items-center gap-2.5 rounded-lg border border-licorice/10 bg-white px-3.5 transition-all focus-within:border-licorice/25 focus-within:ring-2 focus-within:ring-khaki/25">
        {icon && <span className="shrink-0 text-feldgrau/50">{icon}</span>}
        <input
          type={type}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none disabled:opacity-60"
        />
        {trailing}
      </div>
    </div>
  );
}

type PrimaryButtonProps = {
  children: ReactNode;
  type?: "submit" | "button";
  loading?: boolean;
  disabled?: boolean;
  withArrow?: boolean;
  onClick?: () => void;
};

export function PrimaryButton({
  children,
  type = "submit",
  loading,
  disabled,
  withArrow = false,
  onClick,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-licorice text-[13px] font-bold text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-70 disabled:active:scale-100"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2.5">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-isabelline/25 border-t-isabelline" />
          {children}
        </span>
      ) : (
        children
      )}
      {!loading && withArrow && <ArrowRightIcon className="h-4 w-4 text-khaki" strokeWidth={2.5} />}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-dark-red/15 bg-dark-red/5 px-4 py-3 text-[12px] font-medium text-dark-red">
      {message}
    </div>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-4">
      <div className="h-px flex-1 bg-licorice/10" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-feldgrau/60">
        {label}
      </span>
      <div className="h-px flex-1 bg-licorice/10" />
    </div>
  );
}