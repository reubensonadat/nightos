/**
 * Theme & Brand Styling Utility
 * Injects dynamic brand primary, accent, and secondary color variables
 * directly into document.documentElement so Tailwind CSS and vanilla CSS
 * immediately adapt across all screens.
 */

function hexToRgb(hex: string): string | null {
  if (!hex) return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return null;
}

export function applyBrandTheme(
  primary?: string | null,
  accent?: string | null,
  secondary?: string | null
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (primary && primary.trim()) {
    const p = primary.trim();
    root.style.setProperty('--brand-primary', p);
    const rgb = hexToRgb(p);
    if (rgb) root.style.setProperty('--brand-primary-rgb', rgb);
  }

  if (accent && accent.trim()) {
    const a = accent.trim();
    root.style.setProperty('--brand-accent', a);
    const rgb = hexToRgb(a);
    if (rgb) root.style.setProperty('--brand-accent-rgb', rgb);
  }

  if (secondary && secondary.trim()) {
    const s = secondary.trim();
    root.style.setProperty('--brand-secondary', s);
    const rgb = hexToRgb(s);
    if (rgb) root.style.setProperty('--brand-secondary-rgb', rgb);
  }
}
