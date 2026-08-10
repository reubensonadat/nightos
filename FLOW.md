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

## 0 · Staff sign-in — PIN model (legacy POS, free SMS cost)
- **Decision (2026-08-10): staff sign in with phone + PIN. OTP (SMS) retired for
  staff — it costs per message; PIN is the supermarket-POS model (manager sets it).**
- Manager sets each staff's PIN (Staff Manager → Set PIN). PIN stored as a bcrypt
  hash ONLY in `staff.pin_hash`; `staff.auth_user_id` links the Supabase identity.
- Login flow: phone+PIN → edge fn `staff-pin-login` → bcrypt verify → creates the
  staff's Supabase identity on first login (synthetic email + phone claim + email
  confirmed) → `auth.admin.generateLink` (magiclink, NOTHING is sent) → client
  exchanges via `verifyOtp(type:'email')` → normal session. Zero SMS, zero schema
  rewrite of auth.
- RLS unchanged — `is_venue_member` (01-schema-and-logic.sql:25, hardened in
  migrate-fix-staff-visibility.sql) still keys off `auth.users.phone`.
- Facts: `staff.pin` column DOES NOT EXIST (the seed VALUES `pin` at
  seed-velvet.sql:138 was never persisted). `pin_set` flags in every staff list RPC
  are hardcoded `false` (01-schema-and-logic.sql:1230, migrate-staff-edits.sql:29,
  migrate-fix-staff-visibility.sql:56) → become `pin_hash IS NOT NULL`.
- OTP survives ONLY as a customer/owner fallback; the staff app is PIN-only.

## 1 · Arrival (QR) — ✅
- Scan → `/?table=<token>` → venue+table resolved (`useQrTable`).
- Session opens or resumes; bill opens for the table.
- Waiter auto-assigned (people-weighted, on-shift, area match, under
  `max_tables`, idempotent) — fixed & deployed.
- Table → "occupied" for waiter/manager/kitchen.

## 2 · Idle check (pre-order) — ✅ (needs: cron confirmed)
- 20-min no-order → session expired + empty bill closed (`expire_stale_sessions`).
- ✅ Scheduled via pg_cron (job `bysen-expire-sessions`, every minute, verified
  live 2026-08-09); orphan/empty bills are swept even without a session link
  (migrate-expire-orphans.sql).

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

## Delta build order (deadline-paced, updated 2026-08-10)
- ✅ Tier 0 — Staff PIN login (decision above; migrate-staff-pin.sql + edge
  `staff-pin-login` + Staff Manager "Set PIN" + PIN pad in StaffAuthScreen).
- ✅ Tier 1 — waiters, 20-min cron + waiter-created bills get a waiter.
  (94-hour ghost-table root cause; open_bill_for_waiter + RLS heal + orphan
  sweeper all live.)
- ⏳ Tier 2 — Inclusive pricing → venue_taxes + tax_breakdown (replaces the
  hardcoded 10%/12.5%), UI hides "Service charge"/"VAT" rows where off.
- ⏳ Tier 3 — Kitchen + waiter sounds (ping) — small, high client delight.
- ⏳ Tier 4 — "Call waiter" flow.
- ⏳ Tier 5 — Fee settlement button on manager dashboard
  (fee_settled → true, outstanding_balance list exists).
- ⏳ Tier 6 — Detailed receipt (tendered/change, TIN, serial).
- ⏳ Tier 7 — Webhook live GHS 1 test + fee-split verification.
- ⏳ Tier 8 — Cash = waiter CONFIRMS (customer Cash CTA is server-blocked by
  trg_bills_guard_close until this exists).
- ⏳ Tier 9 — Session reuse on QR rescan (rescans spawn duplicate sessions/bills).

## Porting roadmap — from the 3-project audit (Vendly / Roomate_link / Campus_guide)
Legend: ✅ ported · ⏳ planned · ➕ nice-to-have. Origin refs are on the audited apps.

| # | Pattern | Origin (audit ref) | Bysen status |
|---|---------|--------------------|--------------|
| 1 | Staff PIN login (zero-SMS auth) | legacy POS / friend | ⏳ Tier 0 above |
| 2 | Payment spine: pre-generated reference; server-only verify; service-role-only writes | Roomate_link `usePaymentFlow.ts:335-346,183-191`; webhook GET dual-mode `paystack-webhook/index.ts:68-214` | ✅ verify-payment + trg_bills_guard_close + Checkout retry/fallback; ➕ add webhook GET-verify + 5/hr rate limit |
| 3 | Realtime unlock propagation (bill closes without refresh) | Roomate `ProfileContext.tsx:228-255` | ⏳ waiter live-subscribe to bills status; customer already realtime on subsp missions |
| 4 | timeoutFetch (8s AbortController + 1 retry, user-cancel ≠ timeout) | Roomate `lib/supabase.ts:10-84` | ⏳ wrap Supabase client once |
| 5 | TTL cache layer for reads (bills/venue/menu) | Vendly `lib/cache.js`, Campus `cacheService.js` | ⏳ db.* read wrapper w/ invalidate-on-write |
| 6 | Coach marks overlay (per-screen storageKey) | Roomate `CoachMarksOverlay.tsx:18-48`, Vendly `coachSteps.js` | ⏳ waiter first-use tour (dashboard → order → invoice → PIN) |
| 7 | In-app Notification Center (dedupe, unread, mark-read) | Vendly `Sidebar.jsx` + NotificationCenter | ➕ for CAM/waiter pings (Tier 3/4) |
| 8 | Server-validated R2 uploads + client mirror (5MB/MIME) | shared: `generate-upload-url` (3 apps) | ✅ edge fns exist (generate/delete) → ⏳ verify every upload UI uses them |
| 9 | Reusable payment states + env key split PROD/DEV | Campus `paymentService.js:7-14,17-54`; `PaymentButton.jsx` | ✅ PaystackButton key split + guards; ⏳ validation toasts for reference |
| 10 | Error boundaries + branded skeletons per page | Campus `ErrorBoundary.jsx`, Roomate per-route boundaries | ⏳ per-screens (waiter app first) |
| 11 | PWA install prompt for staff devices | Roomate `InstallPrompt` (App.tsx:96-98) | ➕ |
| 12 | Global haptics on taps | Roomate `haptics.ts` + capture-phase | ➕ |
| 13 | Coach-wise "Janitor" sign-out (namespaced localStorage sweep) | Roomate `AuthContext.tsx:72-84` | ✅ partial (nightos:* swept) → ⏳ add bysen:* keys |
| 14 | Product auto-fill (barcode cascade / AI) | Vendly `ProductModal.jsx` | ➕ post-launch |
| 15 | Forecasting / analytics buffering | Vendly `Forecasting.jsx`, Campus `analyticsService.js` | ➕ post-launch |
| 16 | Business extras (mini-games while waiting) | Vendly marketing | ➕ future revenue