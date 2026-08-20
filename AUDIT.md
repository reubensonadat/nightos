# Bysen — System Architecture Audit

Plain-language walkthrough of the whole machine: every table, every function, every automatic job, and who is allowed to touch what. Source of truth: `supabase/01-schema-and-logic.sql` + the `supabase/migrate-*.sql` files. Written in batches so each part can be studied on its own.

---

## BATCH 0 — How the machine fits together

Three apps talk to ONE Supabase database:

1. **Customer app** — guest scans a table QR code, browses the menu, orders, pays via Paystack or Cash.
2. **Bysen manager app** — owner / manager / supervisor dashboard: floor view, staff, shifts, cashouts, money.
3. **Waiter/kitchen side** — waiters open bills and take orders; kitchen sees incoming orders and marks them made/served.

Everything is one Postgres database behind Supabase. The rules live in the SQL files:

- **Tables** (`BATCH 1`) — where the facts live.
- **Functions** (`BATCH 2`) — the buttons the apps press (order food, close a bill, approve a shift…).
- **Triggers** (`BATCH 3`) — automatic enforcers: the database reacts on its own when rows change.
- **Cron** (`BATCH 3`) — one robot sweeper that runs every minute.
- **RLS** (`BATCH 4`) — the bouncer at the door: who may see/touch which rows.
- **Edge functions** (`BATCH 5`) — special HTTP endpoints living alongside the DB for Paystack money and image uploads.
- **Realtime** (`BATCH 6`) — live push so a kitchen screen updates without refreshing.

Money flow in one line: customer pays → `payments` row → triggers update `bills` → `payment_events` logs the Paystack webhook for accounting.

---

## BATCH 1 — The 23 tables

All declared in `supabase/01-schema-and-logic.sql`. Grouped by job.

### The venue itself (4)

| Table | File:Line | What it is |
|---|---|---|
| `venues` | :75 | The restaurant. One row per venue (Velvet Lounge). Owner id, name, payment model, service charge %, VAT %, tax-inclusive flag. |
| `venue_settings` | :156 | Extra settings as key→json pairs, e.g. `max_dwell_minutes`. One row per (venue, key). |
| `tables` | :169 | Physical tables in the restaurant: number, label, capacity, area (Main/VIP/Lounge/Bar/Outdoor/Private), position on the floor plan, QR token (what's inside the QR code). |
| `staff` | :191 | Employees: name, phone, email, role (owner/manager/supervisor/waiter/kitchen/bar/cashier), max_tables, area, pay model + rate. Unique by (venue, phone). |

### Who's working (2)

| Table | File:Line | What it is |
|---|---|---|
| `staff_shifts` | :213 | A clock-in/clock-out record per staff member: when they started, when they stopped, cash they started with, status (active / on_break / closed). |
| *(shift approvals)* | — | No separate table — approval lives as `supervisor_approved` logic inside the shift/queries (see `approve_shift`, `shift_coverage` in BATCH 2). |

### The menu (5)

| Table | File:Line | What it is |
|---|---|---|
| `menu_categories` | :271 | Menu sections: e.g. "Starters", "Hot Drinks". Unique per venue. |
| `products` | :286 | One menu item: name, price, cost price, images, station (kitchen/bar/both), tags, ABV/origin for drinks. `is_archived` hides it without deleting. |
| `modifier_groups` | :313 | Options groups: e.g. "Pick your side" — required?, multi-select?, max picks. |
| `modifier_options` | :327 | The actual options in a group: "Small/Large", "+₵5". |
| `product_modifiers` | :338 | Which products have which modifier groups (many-to-many link table). |

### A guest's visit (4)

| Table | File:Line | What it is |
|---|---|---|
| `customer_sessions` | :373 | A customer scanning the QR = one session: which table, which bill, guest name, party size, unique session token (the key the customer app proves identity with). |
| `bills` | :346 | The heart. A bill = money owed on a table: status (open → settling → paid / cancelled), subtotal, service charge, VAT, total, amount paid, guest count, which waiter, merged-bill links. |
| `order_submissions` | :388 | One "round" of ordering = the chef's ticket: status (pending → confirmed → preparing → ready → served / cancelled), station (kitchen vs bar), priority flag, notes. |
| `order_items` | :406 | Each line of an order: product snapshot (name + price frozen at order time), quantity, chosen modifiers (snapshot json), line total, guest name. |

### Money (3)

| Table | File:Line | What it is |
|---|---|---|
| `payments` | :427 | Every payment attempt: amount, method (mobile_money/card/bank/digital_wallet/cash), reference, status (pending/success/failed/refunded), who collected it, full Paystack data, platform fee. |
| `payment_events` | :447 | The raw Paystack webhook log: reference, event type, amount in pesewas, full payload — one row per webhook hit. Used for accounting + dedupe. |
| `platform_fee` pie | — | Fee is computed and stored on `payments` (`platform_fee`, `fee_settled`) via `platform_fee_for`; `outstanding_balance` sums what the venue still owes Bysen. |

### Stock, customers, extras (5)

| Table | File:Line | What it is |
|---|---|---|
| `inventory_items` | :461 | Stock: name, category, qty on hand, unit, reorder threshold, unit cost, supplier. Optional link to a menu product. |
| `inventory_transactions` | :482 | Every stock movement: +/− qty, reason (sale/restock/waste/spoilage/adjustment/variance), who did it. |
| `reservations` | :498 | Bookings: name, phone, party size, date + time, status (pending/confirmed/seated/cancelled/no_show), deposit. |
| `event_tickets` | :520 | Ticket lines for events: name, date, ticket type, price, total qty, sold qty. |
| `customer_profiles` | :538 | Known customers per venue: phone (unique per venue), visits, total spend, loyalty tier, VIP flag. |
| `expenses` | :559 | Money out: category, amount, description, date, who recorded it. |
| `activity_logs` | :574 | The diary: who (staff/system/customer) did what (action, entity type) with details — feeds the activity feed everywhere. |

**Naming notes vs older docs:** "sessions" = `customer_sessions`, "submissions" = `order_submissions`, "bill items" = `order_items` (modifiers live inside it as a snapshot), "audit log" = `activity_logs`, "customers" = `customer_profiles`.

---

## BATCH 2 — The functions (buttons the apps press)

57 definitions, 44 distinct names across the SQL files. Grouped by who presses them.

### Login & identity (the door)

| Function | File:Line | What it does |
|---|---|---|
| `normalise_phone` | :916 | Converts any Ghana format (024…, 233…, +233…) into one canonical `+233XXXXXXXXX`. **Everything** matches on this. |
| `check_phone_exists` | :140 | "Is this phone known?" — staff or customer profile — decides OTP vs sign-up flow. |
| `resolve_login` | migrate-resolve-login.sql:18 | The central login router: owner (by auth uid) or staff (by email or phone) → returns role + venue + staff id. Client picks the right dashboard from this. |
| `venue_by_phone` | :58 | Phone → venue as **owner** (the restaurant's contact phone logs in as owner). |
| `get_venue_by_staff_phone` | :100 | Phone → active staff row → their venue + role (staff login routing). |
| `get_staff_profile_by_phone` | :117 | Phone-OTP staff fetch their own profile + venue name safely (avoids RLS recursion; never exposes a PIN). |
| `get_staff_by_phone` | :680 | Legacy exact-phone staff lookup (same idea, older shape). |
| `is_venue_member` | :25 | The gate itself: "is this signed-in user part of this venue?" (owner / active staff / venue contact phone). Every RLS policy hangs off this. |
| `request_session_token` / `session_token_matches_bill` / `session_token_matches_self` | migrate-rls-customer-flow.sql:6/:11/:20 | Customer-side identity: turn the `x-session-token` header into RLS checks ("this session belongs to this bill"). |

### Shifts & duty

| Function | File:Line | What it does |
|---|---|---|
| `clock_in_staff` | :234 | Auto clock-in on sign-in; idempotent — reloads/token refreshes never double-clock. |
| `clock_out_staff` | :257 | Auto clock-out on sign-out; stamps the shift closed. |
| `approve_shift` | migrate-shift-approval.sql:19 | Manager/supervisor/owner approves a shift → waiter becomes assignable. `approve=false` closes the shift (takes them off duty). |
| `shift_coverage` | migrate-shift-approval.sql:73 | LiveOps panel: who's on duty / pending / off, with open-bill counts. |

### Ordering (waiter + customer)

| Function | File:Line | What it does |
|---|---|---|
| `get_or_create_table_session` | :753 | QR entry point: validates table token, reuses the newest open bill (or creates one), creates the customer session. |
| `open_bill_for_waiter` | migrate-open-bill-for-waiter.sql:6 | Waiter opens/claims a table: reuse newest open bill if waiterless, else fresh bill owned by the waiter. Kills ghost tables. |
| `assign_waiter_to_bill` | :698 | Load-balanced auto-assign: picks the lightest waiter (guests + 0.5/table) who is active + approved + area-matched + under max tables. |
| `set_order_status` | :1111 | Waiter/kitchen changes an order's status (or cancels it) with logging. |
| `expire_stale_sessions` | :1160 | (cron, every minute) Expires sessions idle >20 min with no orders; cancels their empty orphan bills. |

### Money & closing

| Function | File:Line | What it does |
|---|---|---|
| `platform_fee_for` | :1033 | Bysen's cut: tiered ₵1–₵5 by amount band. One rule for cash and Paystack. |
| `record_cash_payment` | :1047 | Waiter confirms cash: validates, records payment + fee, advances bill to settling/paid, logs it. |
| `close_bill` | :1205 | Waiter closes a table: cancels unpaid open bills, closes sessions, cancels pending items, logs. |
| `outstanding_balance` | :1400 | Sum of unsettled Bysen fees the venue owes. |
| `recent_cash_fees` | :1413 | LiveOps fee ledger: recent cash payments with their fees + table labels. |

### Floor / LiveOps

| Function | File:Line | What it does |
|---|---|---|
| `open_bill_overview` | :1457 | Manager floor view: every open/settling bill per table — guests, waiter, total, paid, age, dwell minutes, merged info. |
| `landed_without_orders` | :1436 | Sessions that scanned in but never ordered — go check on those tables. |
| `recompute_bill_totals` | :1501 | Re-adds subtotal/service/VAT after merge/split moves items. |
| `transfer_bill` | :1536 | Move an open bill to another free table. |
| `merge_bills` | :1581 | Combine two open bills (items, sessions, guests); source cancelled as merged. |
| `split_bill` | :1633 | Split one bill into 2–12, greedily balanced by line totals. |
| `get_venue_setting` | :1482 | Safe reader for `venue_settings` (staff can read, owner writes). |

### Staff management (owner)

| Function | File:Line | What it does |
|---|---|---|
| `staff_list` | :1254 | Roster: roles, pay model, shift info. Any active venue member reads; writes owner-only. `pin_set` is always false (phone-OTP auth, no PINs). |
| `create_staff` | :1274 | Owner adds staff (role/pay validated, duplicate phone rejected, activity logged). |
| `update_staff` | :1344 | Owner edits staff; NULL params keep current values. |
| `set_staff_active` | :1325 | Owner activates/deactivates a staff member. |

### Customers

| Function | File:Line | What it does |
|---|---|---|
| `find_or_create_customer` | :821 | Get-or-create the customer profile for a phone at a venue. |
| `reservations_by_phone` | :1783 | Anonymous customer looks up their own bookings by the phone they booked with. |
| `staff_shift_summary` | :1709 | Waiter's own card: sales collected, tables served, items, shift length, recent activity. |

**Note:** `is_manager` / `is_owner` / `is_waiter` don't exist — `is_venue_member` is the only membership gate. `owner_venue_id()` (used at :1934/:1939) lives in `seed-velvet.sql`.

---

## BATCH 3 — Automatic stuff the database does itself

### The 6 triggers

| Trigger | Fires | What it enforces | File:Line |
|---|---|---|---|
| `on_order_item_change` → `recalculate_bill` | items inserted/updated/deleted | Recomputes bill subtotal + service charge + VAT + total automatically. | :607 |
| `trg_bill_activity_items` → `touch_bill_activity` | items change | Resets the bill's dwell clock (`last_activity_at`). | :636 |
| `trg_bill_activity_payments` → `touch_bill_activity` | payments change | Same dwell clock on payment events. | :641 |
| `on_payment_success` → `update_bill_payment` | successful payment inserted | Credits `amount_paid`, flips bill to settling/paid. | :676 |
| `trg_payments_auto_close` → `bill_auto_close_on_payment` | payment inserted | Same job from another angle: sums confirmed money, closes bill. | :1925 |
| `trg_bills_guard_close` → `bill_close_guard` | bill status update to paid | BLOCKS "paid" unless verified money covers the total (or service_role). The anti-fraud guard. | migrate-payment-trust.sql:15/:35 |

> ⚠️ **Finding:** `update_bill_payment` (:676) and `bill_auto_close_on_payment` (:1925) are two functions doing the same close-bill job, both firing on payment insert. Works today, but it's duplicated logic — one should be the keeper. (Fix list, not urgent.)

### The 1 cron job

| Job | Schedule | Calls | File:Line |
|---|---|---|---|
| `bysen-expire-sessions` | every minute | `expire_stale_sessions()` — expire 20-min-idle sessions, cancel empty orphan bills | :1197 |

### Realtime (live push) — 5 tables on the wire

`order_submissions`, `order_items`, `bills`, `customer_sessions`, `payments` (01-schema-and-logic.sql:1818–1834). The kitchen screen and floor view update live without refreshing.

---

## BATCH 4 — Who can touch what (RLS: 67 policy statements)

The bouncer rules, grouped:

- **Everyone (anon)** — read active venues, active tables, menu (categories/products/modifier groups), active event tickets; create reservations, sessions, bills; read your own bill/orders **only** via the session-token magic header. This is how the QR customer flow works without logins.
- **Venue member** (`is_venue_member`) — read bills, order submissions, items, payments, staff roster, customer profiles, inventory, reservations; update bills/submissions; insert payments. Writes on staff/menu/inventory/expenses are owner-only.
- **Owner only** (`auth.uid() = venues.owner_id`) — staff create/update/deactivate, products, categories, modifier groups, tables, inventory + transactions, expenses, venue settings, activity logs, venue row itself.
- **Customers with token** — insert can add items/payments (`status='pending'` guard on payments), update own session/bill; the kitchen gets a read pass on active submissions/items and waiter names on open bills.
- **Service role** — `payment_events` (webhook writes) and the close-bill guard bypass.

Note: `staff_shifts` read = staff can read own shifts; venue members read all shifts (recreated at migrate-auto-shifts.sql:59). `staff` self-read of own venue roster uses the phone-matching policies.

---

## BATCH 5 — The 6 HTTP endpoints (edge functions)

| Function | What it does | Called by |
|---|---|---|
| `verify-payment` | Takes a Paystack reference + bill id, verifies with Paystack, checks the amount matches the bill (via `expectedBillAmountPesewas`), records the payment with service-role rights. | Customer app when payment returns |
| `paystack-webhook` | Paystack → Bysen push. Verifies HMAC signature (timing-safe hex), logs every event to `payment_events`, marks the payment success. | Paystack, on payment events |
| `generate-upload-url` | Issues a presigned S3/R2 upload URL (5-min TTL, images ≤5MB: jpeg/png/webp/gif/heic) for product photos. | Manager app, uploading product images |
| `delete-r2-object` | Deletes an uploaded image from R2; checks the caller is logged in (venue member) first. | Manager app when image removed |
| `assign-waiter` | Thin service-role wrapper around `assign_waiter_to_bill` for the QR/customer flow. | Customer/waiter flow |
| `mnotify-sms` | Sends the OTP text via mnotify (sender id "Vendly" by default — must match the approved account). | Supabase Auth SMS hook |

Shared: `_shared/cors.ts` (headers), `_shared/fees.ts` (`expectedBillAmountPesewas` — the amount-check both payment paths use).

---

## BATCH 6 — Oddities & fix list (nothing urgent, all safe)

1. **Duplicate payment-close logic** — `update_bill_payment` vs `bill_auto_close_on_payment` both close bills on payment. Pick one.
2. **Duplicate function definitions** — `normalise_phone` defined twice (once at :916, once in the "emergency-fix block" at :2020); `clock_in/out_staff`, `staff_list`, `is_venue_member` each redefined across migrations. Redefinitions are normal migration practice (latest wins), but the schema file's own duplicates are dead weight.
3. **`is_venue_member` lives in 5 versions** — four migrations redefined it (fix-staff-visibility, fix-phone-signin, auth-vendly-pattern). The final canonical version is the Vendly-pattern exact-match (01-schema-and-logic.sql:25 is the base; migrate-auth-vendly-pattern.sql:35 is the final state). The earlier versions matter only as history.
4. **Cron job not de-duplicated** — re-running the schema could register `bysen-expire-sessions` twice. Safe if migrations are run once; worth a guard.
5. **`owner_venue_id()` lives in seed-velvet.sql** — referenced by policies at :1933/:1938 but defined in the seed file, not the schema. Works, but fragile if the seed is ever re-run from scratch.

---

## BATCH 7 — Plain-language copy rules (what the app says to humans)

Every restaurant owner should understand every word on screen. Glossary of internal terms vs what we show:

| Internal term | Say on screen instead | Where |
|---|---|---|
| open order / open bill | "Orders being made", "Unpaid tabs" | LiveOps KPI + panel |
| bill | "bill" (keep — waiters say "bill" at work) | waiter/customer screens |
| settlement / settle | "Collect payment", "Pay", "Confirm Cash", "To Collect" | invoice screen, checkout, order tracking |
| dwell time / idle alert | "No activity for 45m" | LiveOps alerts |
| LiveOps | "Dashboard" | manager nav |
| floorplan | "Tables" | manager nav + screen |
| platform fee / ledger | "Bysen fees", "Recent fees", "Owed to Bysen" | LiveOps fees panel |
| open tabs | "Owed" | waiter summary bar |
| session expired | "Your visit timed out" | customer app |
| free table | "Ready for new guests" | waiter table grid |

Rule of thumb: if a phrase wouldn't be said out loud in the restaurant itself, reword it. This is the "two open Oreos at table 4" test — anyone should be able to read the screen and know what's happening in their own place.

---

*Generated from the live SQL files — verify against the database when changes land. Batches map 1:1 to the schema: 23 tables · 44 functions (57 definitions) · 6 triggers · 1 cron · 67 RLS policies · 6 edge functions · 5 realtime tables.*