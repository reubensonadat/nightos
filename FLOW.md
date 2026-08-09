# Bysen — Canonical User Flow (DO NOT LET THIS DRIFT)

> Source of truth for HOW THE PRODUCT SHOULD WORK. Re-read at the start of
> every session. Schema/code must match this, not the reverse.
> Legend: ✅ exists · 🛠 exists but needs fixing · ➕ not built

## Ground rules (never change)

1. The product is **Bysen** (old files say NightOS — legacy naming only).
2. Menu prices ARE the final price unless a venue turns on auto-tax.
   Revenue side: restaurants bake 5-10% margin into menu prices to cover
   Paystack (~2%) + platform fee (GHS 1→5 tiered).
3. Scanning the QR = "we are ready to order". Not "we're just chatting".
4. **20-minute rule**: scan + no order in 20 min → session expired, EMPTY
   bill auto-closed, table frees, customer re-scans to restart. Bills with
   food are never auto-cancelled.
5. Customer sees everything in-app. SMS is a COST — staff-only, brief.
6. Money lives in the server (triggers/RPCs). Browser only reads totals.
7. Fee economy:
   - Venue = Paystack SUBACCOUNT → bears Paystack's ~2%.
   - Bysen = MAIN account → collects tiered platform fee (1→5 GHS).
   - Webhook computes the fee for online; record_cash_payment for cash;
     unsettled cash fees = "outstanding" balance the venue owes Bysen.
8. Tax lines are PER-VENUE CONFIGURABLE (VAT 12.5 / 15 / flat 4…, NHIL 2.5,
   GETFund 2.5, etc.). Nothing hardcoded.

## 1 · Arrival (QR) — ✅
- Scan → `/?table=<token>` → venue+table resolved (`useQrTable`).
- Session opens or resumes; bill opens for the table.
- Waiter auto-assigned (people-weighted, on-shift, area match, under
  `max_tables`, idempotent) — fixed & deployed.
- Table → "occupied" for waiter/manager/kitchen.

## 2 · Idle check (pre-order) — ✅ (needs: cron confirmed)
- 20-min no-order → session expired + empty bill closed (`expire_stale_sessions`).
- It is scheduled via pg_cron ONLY IF pg_cron is enabled on the project —
  **unverified live** 🛠️.

## 3 · Menu & ordering — ✅ math, 🛠️ pricing model
- `products.cost_price` + `products.price` exist — the margin is implicit.
- Automatic composition: items + modifiers → `order_items` with
  `line_total = (price + mods) × qty` → server recomputes bill totals.
- 🛠️ Today the server ALWAYS adds 10% + 12.5% (`recompute_bill_totals`,
  `01-schema-and-logic.sql:1494`). It must instead honor a venue setting:
  inclusive (price is final, fees 0) vs itemized venue taxes as configured.
- ➕ `venue_taxes` (name, rate, active) + `bills.tax_breakdown` for the
  configurable tax trigger you described (Ghana preset: VAT 15, NHIL 2.5,
  GETFund 2.5; venue may edit to 4% / 12.5% / flat etc.).

## 4 · Kitchen & bar — ➕ sound
- Realtime queue works (pending → … → served) and Kitchen staff see it.
- ➕ LOUD distinct new-order sound on kitchen devices (always-on devices).
- ➕ Waiter phone/tablet pings when they are assigned a new table.
- ➕ "Food ready" one-line SMS to the assigned waiter (v1.5, costed).

## 5 · Customer finishing — 🛠️/➕
- ➕ "Call waiter" button → assigned waiter ping/vibrate.
- ➕ "Initiate bill" → bill to `settling`.
- ✅ Session maps cuts: keep ordering until closed; expired messages
  blocked until re-scan.

## 6 · Payment & closing
- ✅ Bill total read from DB only.
- ✅ Online: Paystack popup → `verify-payment` → webhook → payment row →
  bill closes when Σ(success) ≥ total. Receipt PNG exists.
  🛠️ LIVE GHS-test pending; 2-platform+fee split not verified live.
- ✅ Cash: `record_cash_payment` → platform fee recorded, `outstanding_balance`
  bumps; manager dashboard shows **Owed to Bysen / Settled** list.
  ➕ manager "mark as settled" action (fee_settled → true) is not wired to a button.
- ➕ Receipt formats: simplified vs detailed with TIN, serial no., date,
  tax lines, **cash tendered + change** (waiter enters tendered; Bysen
  computes change) — venue-controlled.

## 7 · Manager cockpit — ✅
- Live: occupied, open bills+waiter, dwell, revenue, top sellers, stock,
  shifts, orders, outstanding fee list. Live streamed, no snapshots.

## 8 · Business extras (NOT in v1 core)
- ➕ mini-games/content while waiting (future; ad revenue idea).

## Delta build order (deadline-paced)
1. 🛠️ Tier 1 — waiters, 20-min cron + waiter-created bills get a waiter.
   (This is the 94-hour ghost-table root cause.)
2. 🛠️ Inclusive pricing → venue_taxes + tax_breakdown (replaces the
   hardcoded 10%/12.5%), UI hides "Service charge"/"VAT" rows where off.
3. ➕ Kitchen + waiter sounds (ping) — small, high client delight.
4. ➕ "Call waiter" flow.
5. ➕ Fee settlement button on manager dashboard.
6. ➕ Detailed receipt (tendered/change, TIN, serial).
7. 🛠️ Webhook live GHS 1 test + fee-split verification.