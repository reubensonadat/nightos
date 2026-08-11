export function cn(...parts: (string | boolean | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

import React from 'react';

export function formatGHS(amount: number): React.ReactNode {
  return React.createElement(
    "span",
    { className: "whitespace-nowrap inline-flex items-baseline" },
    React.createElement("span", { className: "text-[0.8em] opacity-70 font-semibold mr-[2px]" }, "GH\u20B5"),
    React.createElement("span", null, amount.toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }))
  );
}

export function formatGHSString(amount: number): string {
  return `GH₵ ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function generateOrderRef(prefix = 'VL'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${pick(6)}`;
}

export function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `NIGHTOS-${ts}-${rand}`;
}

export function formatTime(ts: number | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  return d.toLocaleTimeString('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function minutesSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function normalizeGhanaPhone(input: string): string | null {
  if (!input) return null;
  let digits = String(input).replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('233')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 9) return null;
  return `+233${digits}`;
}
