# NightOS Global Design Specification

This document defines the strict UI and design system constraints for the NightOS platform. All frontend development using Tailwind CSS must adhere to these exact values to maintain the "Premium Utility" aesthetic and ensure enterprise-grade data legibility.

---

## 1. Global Color System

*   **Deep Espresso (`#1A110B`):** Reserved strictly for high-impact zones, primary active states, and high-contrast typography on light backgrounds.
*   **Sand / Oatmeal (`#F4F3E8`):** The primary application canvas. Reduces eye strain for staff in dimly lit environments.
*   **Soft Warm Ivory (`#FFFFFF`):** Used exclusively for elevated data cards and interactive containers to lift them off the Sand canvas.
*   **Semantic Feedback (Status):** Replace default neons with muted, sophisticated tones. Use deep sage for success/active states and burnt terracotta for low-stock/error alerts.

---

## 2. Component Geometry (Border Radius)

Sharp or slightly softened corners communicate technical capability and precision. Extreme rounding destroys the trust required for financial software.

*   **Standard Data Cards (`rounded-lg` to `rounded-xl` / `8px` to `12px`):** The absolute default for metric cards, table containers, search bars, and buttons. 
*   **Maximum Allowed Limit (`rounded-2xl` / `16px`):** Apply this strictly to massive outer containers, main modal windows, or primary marketing images. Never exceed this limit on structural UI elements.

---

## 3. Typography: Font Family & Sizes

*   **Primary UI & Financials:** **Inter**. The industry standard for complex interfaces; numbers are razor-sharp, highly legible, and natively support tabular alignment.
*   **Marketing & Display:** **Plus Jakarta Sans**. Use for large marketing headlines only.

| Hierarchy | Tailwind Class | Usage |
| :--- | :--- | :--- |
| **Micro** | `text-xs` | Utility labels, table header titles, timestamp metadata. Apply `uppercase` and `tracking-wider`. |
| **Base** | `text-sm` to `text-base` | Default for primary table data, paragraph text, and button labels. |
| **Subhead** | `text-lg` to `text-xl` | Card titles, active section headers, and modal window titles. |
| **Metric** | `text-3xl` to `text-4xl`| Massive KPI numbers (e.g., "Today's Revenue"). Apply `tracking-tight`. |

---

## 4. Typography: Font Weights

Limit the entire platform to these four specific weights. Never use ultra-thin or ultra-heavy weights.

| Weight | Tailwind Class | Primary Use Cases | Examples |
| :--- | :--- | :--- | :--- |
| **Regular** | `font-normal` | Long-form body copy, explanatory text, inactive menu items. | Feature descriptions, timestamps. |
| **Medium** | `font-medium` | Standard interactive elements, form inputs, primary table cell text. | Menu item names, search placeholders. |
| **Semibold** | `font-semibold` | Structural labels, active navigation states, table headers. | Column headers (`CAT.`), active sidebar tab. |
| **Bold** | `font-bold` | Primary numerical KPIs, section titles, high-priority status. | Revenue totals (`GH₵30,330.00`). |

**Strict Application Rules:**
*   **Financial Data:** Always pair numerical metrics with `tabular-nums`. Never render currency or inventory counts in `font-normal`.
*   **Table Headers:** Must use `font-semibold`, `uppercase`, `text-xs`, and `tracking-wider`. 

---

## 5. Layout & Spacing (Padding & Gaps)

Consistent spacing creates rhythm and prevents the dashboard from feeling cramped or overwhelming. 

### Internal Padding (Components)
*   **Data Cards & Modals:** Use `p-6` (24px) for all primary metric cards and modal wrappers to ensure data has breathing room.
*   **Buttons & Inputs:** Use `px-4 py-2` or `px-5 py-2.5` to maintain consistent tap targets across mobile and desktop.
*   **Table Cells:** Use `px-6 py-4` for row data. High padding is crucial for touch-screen accuracy on tablet devices.

### Structural Spacing (Grids & Flex)
*   **Component Clusters:** Use `gap-4` (16px) when stacking tightly related elements (e.g., a label above an input field, or an icon next to text).
*   **Dashboard Grids:** Use `gap-6` (24px) for spacing between major structural columns or metric card grids.
*   **Vertical Sectioning:** Use massive vertical margins/padding (e.g., `py-16` or `py-24`) between entirely different website sections to prevent the "wall of sand" effect.