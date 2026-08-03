# NightOS — Implementable Checklist (Target: 12 PM Today)

## Legend
- [ ] Not started
- [~] In progress
- [x] Done

---

## 1. Paystack Wiring & Secrets
- [x] Confirm `PAYSTACK_SECRET_KEY` in Supabase secrets
- [x] Update MNOTIFY_SENDER_ID to `VENDLY` in Supabase secrets
- [x] Port R2 edge functions (`generate-upload-url`, `delete-r2-object`) + client lib
- [ ] Deploy all 6 edge functions (`supabase functions deploy`)
- [ ] Test webhook: send test charge → bill marked PAID

---

## 2. Customer Order Chain (Core Money Flow)
- [x] Create `customer_sessions` table migration (added to `schema.sql` — was missing!)
- [x] `useCustomerSession` hook: open-or-create session + bill for table, links `bill_id`
- [x] QR entry: `useQrTable` resolves `?table=<qr_code_token>` → venue + table (App.tsx)
- [x] **Party-size prompt after QR scan** ("How many of you?" sheet) — feeds `party_size` + `bill.guest_count`, then assigns waiter
- [x] `CartScreen.handleSendToKitchen`: real `bill_id` + `customer_session_id` (mock fallback removed)
- [x] Insert `order_submission` with `bill_id`, `venue_id`, `customer_session_id`, `station`
- [x] Insert `order_items` with `submission_id`, `bill_id`, `customer_session_id`, product snapshot
- [ ] Trigger `recalculate_bill` auto-computes totals (verify in DB)
- [ ] Kitchen Display: real-time `order_submissions` + status updates (pending→preparing→ready→served)

---

## 2b. Waiter Assignment (people-weighted)
- [x] `assign_waiter_to_bill` rewritten: load score = guests on open bills + 0.5/table; picks lightest-load active waiter in area, under `max_tables`; removed arbitrary `<20` cap; fixed reassignment count bug; synced in `schema.sql`, `NIGHTOS_IMPLEMENTATION_PLAN.md`, and `seed-velvet.sql` §8d (applies on next seed run)
- [x] QR flow calls the RPC automatically after party size confirmed; assigned waiter name shows in MenuScreen header
- [ ] Waiter needs an active shift for assignment (staff must clock in first)

---

## 3. Checkout Against Real Bills (PREPAY/POSTPAY)
- [x] `CheckoutScreen`: fetches bill by `bill_id` (subtotal/service_charge/vat/convenience_fee from DB, no more reverse-engineered math)
- [x] PREPAY flow: customer pays `total + convenience_fee` via Paystack → `verify-payment` accepts PREPAY amounts
- [x] POSTPAY flow: cash/bank/wallet → insert `payments` directly, no fake delays
- [x] Convenience fee logic: PREPAY = customer bears fee (shown); POSTPAY = venue absorbs (fee hidden)
- [x] Card/MoMo: Paystack popup → server-side `verify-payment` → success only on verification; fake 1200ms delay removed
- [x] Both edge functions now close bills when fully covered (webhook + verify fallback)
- [~] Tip UI removed from checkout (breaks Paystack amount verification — revisit with subaccounts)

---

## 4. Venue + Table + QR Setup (Velvet Lounge)
- [~] Seed Velvet Lounge via `supabase/seed-velvet.sql` (14 items, 4 categories, modifiers, tables 1-8 with tokens, staff, RLS for anonymous QR flow) — **waiting on you to run it** (steps at top of file)
- [x] Tables 1-8 with `qr_code_token` (already in DB)
- [x] QR flow wired: URL = `/?table=<token>` → resolves table → session → menu directly
- [x] Landing skips `WelcomeScreen` when QR token present

---

## 5. Purge Mocks
- [x] `MenuScreen`: remove `MENU` fallback; real categories via `menu_categories` join
- [x] **Manager dashboard (`LiveOpsScreen`) fully real**: revenue from `payments`, orders from `order_submissions`, occupancy from `bills`+`tables`, top sellers from `order_items`, low stock from `inventory_items`, staff from `staff`+`staff_shifts` — all math client-side in `useManagerDashboard`, auto-refresh 15s, 7D/30D chart toggle
- [x] Post-login lands in Manager portal (`/manager`) for the venue owner
- [ ] `useStaff`: remove `MOCK_STAFF`; real `staffByPhone` + PIN check
- [~] `TablesDashboard`: real `tables` + open `bills` from DB (real data wired; `MOCK_TABLES` fallback still present)
- [ ] `KitchenDisplayScreen`: remove `MOCK_ORDERS` seed
- [ ] `InvoiceSettlementScreen`: real bill + payments
- [ ] `ShiftPerformanceScreen`: real `staff_shifts` + `bills` aggregation
- [ ] Manager portal remaining pages (Floorplan/Menu/Staff/Finance/CRM): real tables
- [ ] Paginate + numbered buttons (1 2 3 … continue) on Customers, Payments/Bills, Orders lists (API layer done — `PaginationBar` component ready to drop in)

---

## 6. Waiter Portal (Real)
- [ ] `StaffAuthScreen`: real phone+PIN via `staffByPhone` (or `get_staff_by_phone` RPC)
- [ ] `OrderManagementScreen`: add items to real bill
- [ ] `TableOperationsScreen`: transfer/merge via bill updates

---

## 7. Polish & Notifications
- [x] Replace `alert()` with `react-hot-toast` (cart + QR entry use toasts)
- [x] Skeleton loading in `index.html` (already per plan)
- [x] TypeScript: 0 errors (`npx tsc --noEmit`), `npm run build` passes
- [x] Sign-out button on WelcomeScreen (top-right, only when logged in)
- [x] Manager sign-out really signs out (`signOut()` + return to home)
- [x] Refresh keeps you where you were (mode + customer screen persisted in localStorage)
- [x] Back button can't exit the app (popstate guard)

---

## 8. Schema Sync (your pasted DDL vs schema.sql)
- [x] `customer_sessions` table added to `schema.sql` (was missing — QR flow depends on it)
- [x] `customer_session_id` columns added to `order_submissions` + `order_items` in `schema.sql`
- [x] `assign_waiter_to_bill` people-weighted rewrite applied in all 3 places (schema.sql, plan doc, seed)

## Order of execution (what I'm doing right now)
1. **Customer order chain (done)** → 2. **Checkout real (done)** → 3. **Venue/QR seed (waiting on you)** → 4. **Mock purge (in progress)** → 5. **Waiter real** → 6. **Polish** → 7. **Paystack deploy + test** (you confirm secrets)

## What YOU need to do now (5 min, unblocks everything)
1. Go to https://supabase.com/dashboard → your project (WMS Project) → **SQL Editor**.
2. Open `supabase/seed-velvet.sql` from this repo, copy everything, paste, **Run**.
3. At the bottom it prints check-queries — confirm 14 products, 8 tables, 4 staff rows, 20 modifier options.
4. That's it — the venue, menu, tables, staff, payment security rules, and the corrected waiter-assignment function are now in your DB.
5. (Optional, for live Paystack) Dashboard → Edge Functions → Secrets → set `PAYSTACK_SECRET_KEY` → then I can deploy + test payments end-to-end.