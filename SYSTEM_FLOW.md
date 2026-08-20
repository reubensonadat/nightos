# Bysen — System Flow (Canonical Behaviour Document)

> **Purpose.** Source of truth for *how the system must behave* — every actor,
> every flow, every state transition, every edge case, every invariant.
> FLOW.md is the parent document (ground rules, fee economy, porting roadmap).
> This document is the full product spec, written in batches: Customer →
> Kitchen/Bar → Waiter → Payments → Manager/Owner → Notifications → Scale.
>
> **How we use it.** Once agreed, we produce `AUDIT.md`: every numbered item
> mapped to its implementation (file:line / SQL object / edge fn) with status
> ✅ / 🛠 / ➕ / ❌ and a prioritized fix list. **We are not rewriting the
> architecture** — the base is built; we verify it behaves like this and fix gaps.
>
> **Legend:** ✅ exists in code · 🛠 exists but needs work · ➕ not built ·
> ❓ decision needed (recommendation given)

---

# 0 · Global invariants (laws that never break)

These are the laws of the system. Every flow must uphold them; anything that
violates one is a bug, not a feature.

1. **Money is recorded only server-side.** The browser never writes totals,
   never records a `success` payment, never closes a bill. Server paths only:
   `record_cash_payment` RPC, `verify-payment` edge fn, `paystack-webhook`
   edge fn, and DB triggers. Customers may only write `pending` payment rows.
2. **The bill is the source of truth for money.** `bills.total`, `subtotal`,
   `vat`, `service_charge`, `amount_paid` are authoritative. The client shows
   server math; it never derives a payable from its own arithmetic.
3. **A table never has two open bills.** At most one `open`/`settling` bill per
   table at any moment. Waiter-created and customer-created paths converge on
   the same bill.
4. **A bill with food is never auto-cancelled.** The 20-minute expiry closes
   only bills with zero order items.
5. **A bill closes only when confirmed money covers it.**
   `Σ(success payments) ≥ total − 0.005` (GHS rounding tolerance). No exception
   on the customer path.
6. **Every state change is auditable.** Status transitions, payment attempts,
   complaints, cancellations, merges, inventory adjustments all leave an audit
   trail (`activity_logs`, `payment_events`, dedicated fields). Nothing is
   silently deleted.
7. **Every write is idempotent or guarded against doubles.** Reference-unique
   payments, single-flight buttons, guard triggers on concurrent merges/settles.
8. **Everything is venue-scoped.** Every query and RLS policy keys off
   `venue_id`. A customer at Table 5 of Venue A can never see Venue B.
9. **Ordering never creates a second bill mid-session.** Once a session has an
   open bill, all further orders append to it until it is paid/cancelled.
10. **The waiter is always in the loop.** A customer cannot settle and vanish:
    settlement notifies the assigned waiter, closes the session, frees the
    table. Cash payment is impossible without the waiter recording it.

---

# BATCH 1 · CUSTOMER FLOW

## 1.1 Arrival — QR scan → session

**Trigger.** Customer scans the table QR (`/?table=<token>`); the app resolves
venue + table, then opens or resumes a session.

**Sequence.**
1. QR token → `tables.qr_code_token` → venue + table. Unknown token →
   "Invalid QR code" + Try Again. ✅
2. **Session resolution** (the airtight part — rescan rules):
   - **Case A — no session for this table:** create one (`status='active'`,
     guest_name `Guest`, party_size 1). ✅
   - **Case B — active session exists:** resume it; its bill (if
     `open`/`settling`) is reused — the same bill keeps growing. ✅
   - **Case C — session exists but its bill is `paid`/`cancelled`:** the
     previous visit is over. The system must **close that session** and open a
     **fresh session + fresh bill** (empty cart, party prompt again). 🛠 today
     the old session is reused (FLOW.md Tier 9). After paying, a re-scan must
     never surface the previous party's items, cart, or bill.
   - **Case D — session is `expired` (20-min no-order):** block ordering; show
     "Session expired — re-scan to start fresh". Waiter/manager still see the
     table as "landed, never ordered". ✅
3. **Bill convergence:** if a waiter already opened a bill for the table
   (`open_bill_for_waiter`), the session attaches to that bill — one open bill
   per table (Invariant 3). ✅ function exists; ⚠️ it lives only in
   `supabase/migrate-open-bill-for-waiter.sql` and must be applied to the live
   DB (verify in audit).
4. Party prompt fires once per session (1.2). ✅

**Edge cases.**
- E1.1.1 Two people scan the same QR at once → both resolve to the same
  session + bill (idempotent lookup). No duplicate sessions. ✅ by design.
- E1.1.2 App refresh mid-visit → session resumes, orders restored (local
  storage keyed by session id). ✅
- E1.1.3 Scan a table whose bill is `settling` (partial payment exists) →
  customer sees the remaining balance; new orders are blocked while settling
  (see 1.5.6).
- E1.1.4 Scan during a network outage → session still opens from cache where
  possible; order placement fails with a retry-friendly toast; the bill is
  never half-created. ❓ (verify current failure UX)

## 1.2 Party prompt

**Trigger.** First in-session activity: "How many of you?" + optional guest name.

**Sequence.** Confirm → updates `customer_sessions.party_size/guest_name` +
`bills.guest_count` → re-runs waiter assignment with the new headcount. ✅

**Rules.**
- Prompt shows once per session (flag `nightos:party:<sessionId>`).
- Min 1, max ❓ venue setting (default 12).
- Guest name optional (default `Guest`); the first confirmed name wins; later
  confirms only update the size. ❓

**Edge cases.**
- E1.2.1 If the session was wrongly reused (1.1 Case C), the stale flag must not
  suppress the prompt — fixed by the Case C fix.
- E1.2.2 Dismissed → default 1, no nagging.

## 1.3 Menu & cart

**Trigger.** Customer browses, opens the item sheet, customizes, adds to cart.

**Rules.**
- Products + categories fetched per venue; inactive/archived hidden. ✅
- **Modifiers:** the item sheet loads the product's groups (required,
  multi_select, max_select) + options with `price_delta`. Line price =
  `(product.price + Σ option deltas) × qty`. 🛠 — modifier data is **never
  fetched today**; schema + seed exist, the fetch and math must be wired
  (MenuScreen / ItemDetailsSheet / api.ts).
- **Sold-out guard:** venue toggles a product off or stock hits 0 → item shows
  disabled ("Sold out") in the customer menu. 🛠 (needs inventory toggle wired
  to the menu — 5.3)
- Cart is **device-local and session-scoped** (keyed by session id). A fresh
  session starts empty — never inherits the previous party's cart. 🛠 today the
  cart key is global.
- Cart survives refresh within a session. ✅
- **No-table flow** (`/menu` without `?table`): browsing allowed; ordering
  requires a table → friendly "scan the QR at your table" screen instead of a
  silent failure. 🛠 (today ordering may silently fail — decide: hard-block)

**Edge cases.**
- E1.3.1 Price changes between add and order → **server recomputes** from
  `products` at submission; the bill uses server math (Invariant 2).
- E1.3.2 Required modifier missing → can't add to cart. ✅
- E1.3.3 `max_select` exceeded → blocked. ✅

## 1.4 Place order → submission lifecycle

**Trigger.** Customer taps "Send to Kitchen" (POSTPAY) or "Pay & Send" (PREPAY).

**Sequence.**
1. Validate: session active, bill `open` (not settling/paid/cancelled), cart
   non-empty. ✅
2. Create `order_submissions` (one per station) + `order_items` rows. Server
   recomputes the bill: `line_total = (price + mods) × qty`, then
   subtotal/service/vat/total. ✅
3. **Station routing:** items route to `kitchen`/`bar`/`both` per product
   station. Mixed order = one submission per station. A bar-only order must
   never land in the kitchen queue. 🛠 (waiter-placed orders currently stamp
   everything `kitchen`; verify customer path too)
4. Order appears: kitchen/bar queue (realtime) → waiter's table card → the
   customer's tracking tab. ✅
5. Status chain and **who may advance it**:

   | From | To | Allowed by |
   |---|---|---|
   | pending → confirmed | kitchen/bar | kitchen/bar |
   | confirmed → preparing | kitchen/bar | kitchen/bar |
   | preparing → ready | kitchen/bar | kitchen/bar |
   | ready → served | **waiter** (food physically handed over) | waiter |
   | any → cancelled | before served, with reason | kitchen (stock), waiter, ❓ customer (only while pending) |

   ❓ Convention decision: **the waiter marks served** (kitchen marks ready).
   This keeps kitchen staff on the pass and gives the waiter the hand-off.
6. **Ordering again (same session)** — the core requirement: the customer taps
   "Add more items" → new submission on the **same open bill**. The system
   never creates a second bill and never breaks between "first order" and
   "pay". ✅ by design — audit must prove no code path creates a bill when one
   is open.

**Edge cases.**
- E1.4.1 Submission insert succeeds but an item insert fails → the empty
  submission must be rolled back or deleted, else the kitchen sees a ghost
  ticket. 🛠 (retry can double-submit today)
- E1.4.2 Double-tap "Send" → single submission (idempotency guard on the
  button + dedupe check). 🛠
- E1.4.3 Bill flips to `settling` between cart render and submit → reject with
  "payment in progress". 🛠
- E1.4.4 Kitchen advances to `ready` while the customer adds items → both
  coexist: old submission `ready`, new one `pending`; queue renders per
  submission. ✅ by design.

## 1.5 Idle, long-wait, and expiry rules

**Idle (no order).**
- 20 minutes of no order → cron `expire_stale_sessions` (every minute) expires
  the session, auto-closes the **empty** bill, frees the table. ✅
  (migrate-expire-orphans also sweeps orphan bills not linked to a session ✅)
- ➕ **Nudge at 15 min:** in-app banner "Table expires in 5 min — place an
  order to keep it." No SMS (customer is in-venue; SMS is a cost).
- A bill with food is **never** auto-cancelled (Invariant 4). ✅

**Long-wait (ordered but not served).**
- ➕ Escalation ladder (thresholds = venue settings, defaults below):
  1. `ready`-or-earlier for > 20 min → ping the **assigned waiter** (loud
     sound + in-app) with the elapsed time.
  2. > 30 min → **manager alert** on LiveOps (banner + entry in alerts list).
  3. > 45 min → **owner/manager SMS** (one line, costed). ❓
- Timestamps for this come from transition times stamped on every status
  change (see 2.4 — write-on-transition, cheap, same trigger).
- Kitchen needs a visual **elapsed-time clock** on every ticket so they
  self-regulate before the ladder fires. ➕

## 1.6 Paying the bill

**Trigger.** Customer taps Pay (only when the kitchen marked items `served` —
the gate already exists ✅).

**Rules.**
1. **Pay cannot bypass the waiter** (Invariant 10): any settlement notifies the
   assigned waiter (in-app + sound), closes the session + bill, frees the
   table, and offers the receipt. ➕ waiter notification today is missing.
2. **Online (card / MoMo):**
   - Paystack popup initialised with the exact remaining amount
     (`bill.total − amount_paid`). 🛠 the server gate currently expects the
     **full total** — any partial payment (split bill, cash + card mix) is
     rejected. Amount gate must be remaining-balance everywhere.
   - Initialisation must be **fast**: one Paystack call, no extra round-trips
     before the popup (a slow init loses customers). Paystack supports
     `amount`/`email` upfront; keep the key, bill id, and venue id in
     metadata. ✅ skeleton, audit the latency.
   - Verification: popup callback → `verify-payment` edge fn (server queries
     Paystack) → webhook `charge.success` → payment row → trigger closes the
     bill when Σ ≥ total. ✅ idempotent-by-reference; 🛠 see 4.2.
3. **Cash:**
   - Customer taps "Pay with cash" → told **a waiter will confirm**. The
     customer-side CTA is server-blocked until the waiter records it. ✅
     (migrate-payment-trust)
   - Waiter on their device: enter tendered → Bysen computes change → confirm
     → `record_cash_payment` → platform fee recorded → bill closes → both
     waiter and customer see confirmation. 🛠 tendered/change computed in UI
     only, never persisted — persist for the receipt (Tier 6).
4. **Partial & split payments:** any mix (cash + card, two cards, split across
   guests) must settle correctly; each payment lands on the same bill;
   `amount_paid` grows; bill closes when Σ covers it. 🛠 server gate fix (2)
   is the enabler.
5. **Settlement is final but refundable:** after closure no new orders; refunds
   reopen the bill if under total (4.2.6).
6. ❓ **Settling-state rule:** while a bill is `settling` (partial payment),
   new orders are **blocked**; the kitchen finishes what's cooking. Decided by
   the manager flow? Keep simple: block. (Customer sees "payment in progress".)
7. **Receipt:** PNG receipt in-app. ❓ detailed variant (TIN, serial no., tax
   lines, tendered + change) is venue-controlled — v1.5.
8. **PREPAY venues:** "Pay & Send" — the initial order is charged before the
   kitchen starts it; additional orders are paid the same way (top-up the same
   bill). Kitchen sees only prepaid items. 🛠 `payment_model` is displayed but
   never enforced — enforce at submission (prepay: reject submission until the
   bill's `amount_paid ≥ new order total`).
9. **Post-settlement state:** session closes, table frees, both waiter and
   manager see it live. ✅ (via triggers) — audit that the session is closed
   (Case C depends on it).

## 1.7 Call waiter & food complaints

**Call waiter.**
- ➕ Button (in-app, always visible on the tracking tab): pings the **assigned
  waiter** — loud unique sound + vibration + banner; escalates to manager if no
  waiter assigned (E10.11). SMS fallback only if the waiter has no live
  session ❓ (they normally do — phone-first).
- Anti-spam: max 1 ping per 60s per session. ➕

**Food complaint (customer, or waiter on the customer's behalf).**
- ➕ Flow: pick the item → pick a reason (wrong item / undercooked / quality /
  missing / temperature / other) → optional note → submit.
- Recording: an **issue record linked to the order item** (never deleted —
  Invariant 6), visible to:
  - the kitchen queue (badge on the ticket),
  - the assigned waiter (notification + banner),
  - the manager dashboard (LiveOps alert + a complaints list in reports).
- Resolution (kitchen or waiter): **remake** (kitchen re-prioritises the item),
  **swap** (waiter adds replacement, old line removed), or **void** (line
  removed from the bill, totals recomputed server-side, reason stored).
- ➕ All three resolution actions write audit trail + recompute the bill.
- If a complaint arrives after the bill is `settling` → it still records, but
  the resolution (void/refund) is handled by the manager. ❓

## 1.8 Cancellations

- **Customer:** only while `pending` (kitchen hasn't started) — cancel the
  whole order or a line. ➕ (not built; today only staff can cancel)
- **Kitchen:** cancel before `served`, reason required (out of stock, spillage).
- **Waiter:** cancel anytime before `served`; after payment → refund path (4.2.6).
- **Effect:** line items removed, `bills` totals recomputed server-side, the
  submission stays as an auditable record with status `cancelled`. ✅ partial
  (status exists; customer-triggered cancel is not built)

## 1.9 Reorder

- History card → "Order again" pre-fills the cart from the saved snapshot. ✅

---

# BATCH 2 · KITCHEN / BAR FLOW

## 2.1 The queue

**What it is.** One real-time board per station (kitchen / bar), newest first:
ticket number, table + area, items with modifiers, guest name/party size,
waiter, elapsed clock per ticket. ✅ core exists (KitchenDisplayScreen) —
audit for the elapsed clock ➕ and the bar-station split 🛠.

**Rules.**
- A submission appears only on its own station's board (routing per 1.4.3).
  🛠 station bug (waiter orders stamp `kitchen`).
- Once `ready`, the ticket moves to a "ready" strip (colour-coded) until the
  waiter marks `served`. ✅ partial
- **New-order alert:** loud, distinct sound + screen flash on the always-on
  device. ➕ (free clip from Mixkit/Pixabay — see 6.2; custom engineered pack
  later for pay). Sounds must keep working on an always-on screen with
  auto-wake (screen-wake API / device settings). ➕
- Multi-device: two kitchen screens show the same board (realtime broadcast,
  one source of truth). ✅

## 2.2 Status transitions (kitchen side)

| Transition | Who | Notes |
|---|---|---|
| pending → confirmed | kitchen/bar | "We got it" — customer sees it immediately |
| confirmed → preparing | kitchen/bar | |
| preparing → ready | kitchen/bar | **triggers waiter food-ready ping + SMS** ➕ |
| ready → served | **waiter** (hand-off) | removes ticket from the board |
| → cancelled (pre-served) | kitchen/bar/waiter | reason required |

- Every transition stamps a timestamp on the submission (2.4) and writes an
  `activity_logs` row. ✅ status writes exist; ➕ transition timestamps +
  activity log entries.
- ❓ State machine enforcement: should `set_order_status` RPC validate legal
  transitions (e.g. no `pending → served`)? Recommendation: yes — a single
  SECURITY DEFINER RPC that whitelists transitions per role, so the UI can
  never drive the DB into an illegal state. Today the RPC accepts anything. 🛠

## 2.3 Out-of-stock at prep (edge case — must not break the flow)

1. Kitchen discovers an item can't be made (product finished / bad batch).
2. Kitchen marks the line `unavailable` + reason → **the bill recomputes
   server-side** (line removed) and:
   - the customer's tracking tab shows it instantly (realtime) with the
     reason ("sorry, Chicken Jollof is finished"),
   - the waiter gets a ping with the reason,
   - the kitchen queue marks the item red.
3. Waiter offers a **swap**: adds the replacement to the same bill, same
   session — new submission to the kitchen (or same ticket if quick). ➕ all
   of this is new.
4. If the customer already paid that line (PREPAY), the voided amount goes
   back as a **credit on the bill** (auto-applied to the next order or
   refunded at settlement). ❓ v1.5 — decide.

## 2.4 Wait-time metrics (the kitchen's clock becomes data)

- On every status transition the server writes the transition timestamp
  (same trigger as the status write — no extra round-trips). 🛠 → ➕
- Aggregates (avg time per stage, per station, per hour/day, today vs
  yesterday) are computed **client-side** for live dashboards, and a
  **snapshot table** is batched every 10 minutes (cron) for history —
  the DB is not hammered per transition (see 8.2). ➕

## 2.5 Spillage / waste / variance reporting

- Kitchen, bar, or waiter can report: item + qty + reason (`waste`,
  `spoilage`, `variance`) + notes + ❓ optional photo.
- Writes an `inventory_transactions` row ✅ (schema exists) and decrements
  stock server-side. ➕ (no UI/flow yet)
- Manager sees it live on LiveOps and in inventory/financial reports. ➕
- Never silently re-credited; the transaction is the audit record (Invariant 6).

## 2.6 Kitchen staff scope

- Kitchen/bar staff have **no POS powers** — queue, transitions, stock
  reports, complaint resolution only. RLS + UI enforce it. ✅ partial
- Sign-out **must clock out** the shift. 🛠 (today kitchen exit just navigates
  away, leaving an active shift — migrate-auto-shifts eventually closes it)

---

# BATCH 3 · WAITER FLOW

## 3.1 Shift lifecycle

1. **Clock in** at the venue with a starting cash balance (`cash_balance_start`,
   default 0). ✅
2. **On break** (pause assignment + table pings). ✅ partial
3. **Clock out** with the ending cash balance → shift closed →
   **supervisor approval** required before the shift counts for
   auto-assignment or cash reconciliation. ✅ (migrate-shift-approval)
4. Auto-clock-out at end of day for abandoned shifts ✅ (migrate-auto-shifts).
5. Shift summary screen per waiter (time, sales, tips ❓, cash balance
   variance). ✅ partial (ShiftPerformanceScreen exists)

**Rules.**
- Waiter assignment only picks staff with an **approved** active shift, on
  duty (not on_break), under `max_tables`. ✅ (assign_waiter_to_bill)
- ❓ No eligible waiter at scan → bill stays unassigned; manager sees an
  "unassigned bills" alert; assignment retries on next clock-in. (decide)

## 3.2 Dashboard

- Live list: my tables (occupied, guests, dwell, bill total, order statuses,
  pending actions) + **unassigned tables** I can claim. ✅ partial (TablesDashboard)
- Table actions: open bill, add items, view order, mark served, settle,
  call/cancel, merge. ✅ partial
- **Realtime bill status:** the waiter's board updates when a customer pays
  online without a refresh. ❓ (subscribe to bills where waiter_id = me —
  porting roadmap item 3) — recommend doing this: cheap and demo-visible.

## 3.3 Order management on behalf of a table

- Open a bill for any table (even one the customer hasn't scanned yet) →
  customer scan converges onto it (1.1.3). ✅
- Add items with modifiers → route to correct station. 🛠 station bug (1.4.3).
- **Mark served** when handing food over (the kitchen hand-off convention,
  2.2). ❓ today the waiter UI has no served action — kitchen-only. Decide:
  give the waiter the served button (recommended — it's the hand-off moment).
- Waiter-created orders are stamped with the waiter for attribution. ✅
- Reassign/claim: take over another waiter's table (e.g. they clocked out) —
  manager approval ❓ or free-form (recommend: free-form, audited).

## 3.4 Invoice settlement (the waiter's money screen)

**Cash.**
1. Waiter opens the bill → sees total and remaining (never client-derived).
2. Enters **tendered** → system computes **change** → confirm.
3. `record_cash_payment` (server): fee tier computed (4.1), `amount_paid`
   grows, bill closes when covered, tendered/change **persisted** for the
   receipt. 🛠 (tendered/change computed in UI only today)
4. Double-tap protection: settlement button goes single-flight + idempotency
   key (Invariant 7). 🛠

**Card / MoMo.**
- Customer pays on their own phone (popup on their device). The waiter screen
   shows live status and confirms closure. ✅ display-only today.
- ❓ Waiter-initiated payment ("you're ready to pay — I'll start the charge"):
  v1.5, same Paystack flow from the waiter device. Not required for the demo.

**After settlement.**
- Receipt (customer + venue copy ❓), session closes, table frees, manager
  board updates live, customer's complaint/issues remain in the audit trail.

## 3.5 Table merging (one guest pays two tables)

**When.** Person A at Table 1 and Table 2 (same group, e.g. a family) — one
person pays both bills.

**Sequence.**
1. Waiter picks a **paymaster bill** (e.g. Table 1's open bill) and merges
   Table 2's open bill into it.
2. Server (SECURITY DEFINER `merge_bill`, ❓ exists? verify in audit — schema
   columns `is_merged` + `merged_into_bill_id` exist ✅):
   - both bills' items + guest counts transfer to the paymaster bill;
   - `is_merged=true` on the secondary bill, `merged_into_bill_id` set;
   - secondary bill flips to `cancelled`-like closed state ❓ (recommend a
     distinct `merged` status, not `cancelled`, so reports don't miscount);
   - both tables stay occupied; both sessions stay open (kitchen still sees
     per-table tickets but they label "merged T1+T2").
3. Payment covers the **combined** total → paymaster closes → **both** tables
   free, **both** sessions close.
4. **Unmerge** while open: items return to the original bills, flags cleared
   (audited). ➕
5. Merge after partial payment ❓: allowed — remaining balance combines.
6. Concurrent-merge guard: two waiters can't merge the same bill twice
   (Invariant 7; advisory lock or status check inside the RPC).

**Invariant.** A bill can be merged into a paymaster or be a paymaster — never
both. `is_merged` = secondary only.

## 3.6 Waiter notifications (matrix)

| Event | Channel | Sound | SMS? |
|---|---|---|---|
| New table assigned | in-app banner | ping | ❓ optional |
| Food ready (any of my tables) | in-app | loud "ready" | **yes** (1-line) |
| Call waiter | in-app full-screen | loud ping + vibrate | no (they're on shift) |
| Food complaint on my table | in-app | ping | no |
| Bill settled online | in-app | soft ping | no |
| Long-wait escalation | in-app | ping | only ≥ 45 min (manager) |
| Shift reminders (clock-in due) | in-app | — | no |

- Waiter phones vibrate on every ping (`navigator.vibrate`). ➕
- All of these are ➕ except a bare minimum today — this matrix is the spec
  for the notification build (7).

---

# BATCH 4 · PAYMENTS & FEES

## 4.1 Platform fee (Bysen's revenue)

**Tiered flat fee per settlement (GHS):**

| Bill total (GHS) | Fee |
|---|---|
| 0 – 50 | 1 |
| 50.01 – 100 | 2 |
| 100.01 – 150 | 3 |
| 150.01 – 200 | 4 |
| 200.01 + | 5 |

- Fee applies **once per bill closure** (not per payment; a split bill pays one
  tier on the combined total). ❓ confirm.
- ✅ `platform_fee_for` exists in SQL with the same tiers — verify boundaries
  match the table above exactly in the audit.

**Online (card/MoMo):**
- Venue = Paystack **subaccount** (`venues.paystack_subaccount_code` ➕ column).
- At charge time pass `subaccount` + `transaction_charge` (the tiered fee) +
  `bearer: 'subaccount'` → Paystack splits automatically; Bysen collects from
  the main account; the venue sees the split in their Paystack dashboard.
  🛠 zero wiring today (PaystackButton types declare it, config never sets it).
- The fee split must be **verified with a live GHS 1 transaction** before
  launch (FLOW.md Tier 7).

**Cash:**
- `record_cash_payment` computes the same tier, stores `platform_fee`,
  `fee_settled=false` → lands in "Owed to Bysen". ✅
- **Settlement:** manager marks fees settled (`fee_settled=true`) per payment
  or batch. ➕ no RPC/button today (Tier 5).

**Bysen balance / top-up (v1.5 ❓):**
- Venue tops up (e.g. GHS 500) via Paystack → `venue_balances` credits.
- Every fee event (cash or online) **auto-deducts** server-side.
- Manager sees credits + full fee ledger; top-up button; negative balance →
  alert before new fees accrue (policy ❓: block new cash settlements vs
  allow-and-owe).
- Recommended: build the ledger + auto-deduct now (it's the same money math),
  ship the top-up UI later.

## 4.2 Payment integrity (the money rules)

1. **Writers of `success`:** webhook, verify-payment, record_cash_payment —
   only server paths. Customers write only `pending`. ✅ (migrate-payment-trust)
   ⚠️ Audit flag: the customer-facing `createPayment` in api.ts inserts
   `success` — it violates the policy and must be removed/replaced (the
   bank/wallet/cash buttons it feeds will be cut from the customer UI).
2. **Amount gate = remaining balance:** `expected = total − Σ success`.
   🛠 currently `expected = total` in both edge functions → split/partial
   payments rejected. Fix in `_shared/fees.ts` + both functions, and include
   `amount_paid` in the bill select.
3. **Idempotency:** one payment per `reference` (unique index ✅); replays
   dedupe in both verify-payment and webhook ✅.
4. **Auto-close:** trigger closes the bill at `Σ success ≥ total − 0.005`. ✅
   ⚠️ two competing triggers exist (old `update_bill_payment` + newer
   `bill_auto_close_on_payment`) — consolidate to one in the audit.
5. **Settling state:** partial payment → bill `settling`, orders blocked
   (1.6.6). 🛠 (settling exists; order-block does not)
6. **Refunds:** webhook `charge.refund` → payment `refunded`, amount re-added,
   bill reopens if under total, manager alerted. ➕ not handled today.
7. **Overpayment / double-tap:** `record_cash_payment` capped at remaining;
   settlement buttons single-flight; webhook + verify both reject when the
   bill is already covered. 🛠
8. **Audit:** every verify + webhook write a `payment_events` row with a
   composite key (both must survive — today one overwrites the other 🛠).
9. **Channel mapping:** Paystack `channel: 'mobile_money'` must map to
   `method: 'mobile_money'`, not `digital_wallet`. 🛠 (reports skew today)
10. **Unreconciled payments:** if the popup callback never verifies, the
    webhook still closes the bill; a manager "reconciliation" view lists
    payments with no matching bill-close (rare, but must be visible). ➕

## 4.3 Keys & environments

- Client: `VITE_PAYSTACK_PUBLIC_KEY` (dev) / `VITE_PAYSTACK_LIVE_KEY` (prod).
  🛠 live key missing from .env — prod popup currently disabled.
- Server: `PAYSTACK_SECRET_KEY` + service role only in Supabase Edge Function
  secrets — never in the client. ✅ convention; verify both functions read
  from env.
- One platform Paystack account; per-venue subaccounts. ✅/❓

---

# BATCH 5 · MANAGER / OWNER FLOW

> Manager and owner see and control the **same dashboard** (one role model).
> The only difference later is multi-branch scoping via RLS (owner = all
> branches, manager = one branch).

## 5.1 LiveOps (the live cockpit)

**Realtime data (all live, no refresh):**
- Table occupancy: free / occupied / settling, guest count, dwell time.
  ✅ partial
- Open bills with assigned waiter + bill total. ✅ partial
- Orders in flight: per table, per station, elapsed time. ✅ partial
- **Average order wait time** — live + today's trend (from transition
  timestamps, 2.4). ➕
- Revenue today (online vs cash split). ✅ partial
- Top sellers today. ✅ (hack present: fabricated entry if exactly 2 — fix)
- Inventory: low-stock alerts, out-of-stock toggles. 🛠
- Shifts: who's on, since when, cash balances, approval queue. ✅ partial
- **Outstanding fees:** "Owed to Bysen" ledger with **Mark settled** action.
  ➕ button (ledger read exists).
- Alerts feed: long-wait escalations, unassigned bills, session expiries,
  complaints, spillage/waste, unreconciled payments, low stock. ➕ (partially
  surfaced; make one unified list with read/unread)
- Every dead button (New Order, View Report, Review, View All…) either works
  or is removed. 🛠

## 5.2 Floorplan

- See all tables with occupancy detail (guests, waiter, bill, dwell, merged
  state) + QR download/copy per table. ✅
- ➕ Table CRUD (add / remove / reposition / resize / areas / capacity) — v1.5.
- Toggling a table offline (maintenance) should block new sessions. ❓ v1.5

## 5.3 Menu & inventory

**Products & menu:**
- Create / edit / archive products: name, price, cost price, description,
  images (R2 upload), station (kitchen/bar/both), tags, sort order. ➕ UI
  (schema ✅)
- Categories: create / edit / reorder / hide. ➕ UI (schema ✅)
- Modifiers: groups + options + price deltas, attach per product. ➕ UI
  (schema ✅ — same data the customer flow needs in 1.3)
- **On/off toggle per product** → instantly hides it from the customer menu
  ("Sold out"). 🛠 → ➕ (inventory toggle exists, not wired to the menu)

**Inventory:**
- Stock levels per item, unit, reorder threshold, supplier, cost. ✅ CRUD
- Transactions in/out: restock / sale / waste / spoilage / adjustment /
  variance with notes + created_by. ✅ schema, 🛠 UI partial
- ❓ **Sale deduction:** deduct stock when items are served (recommended —
  counts only confirmed-served items; anything else double-counts waste) or
  nightly reconciliation (simpler, less accurate). Recommend: deduct on
  `served`, keep variance reporting for drift.
- Low-stock → alert + optional auto-hide the product. ➕

## 5.4 Staff management

- CRUD staff: name, phone, role, area, max_tables, hourly/salary, active.
  ✅
- **Set PIN** for PIN login (FLOW.md Tier 0 decision says PIN; the code today
  is phone-OTP — audit gap to resolve; see 6.3).
- Shift approval queue (clock-out + cash handover). ✅
- Staff list shows shift state, cash start/end, approved. ✅ partial

## 5.5 Financial reports

- Revenue (online vs cash vs refunds), net profit (revenue − expenses), AOV,
  table-turn, top sellers, tax collected, platform fees (owed vs settled),
  expense categories by month. All math **client-side** from DB data. 🛠
  (expense-month bug, custom-range bug, dead export — audit fixes)
- Exports CSV/PDF. 🛠
- Merged-bill revenue must not double-count (merged bill = one sale). ⚠️

## 5.6 CRM & marketing

- Customer profiles: visits, spend, tier, VIP flag. ✅
- Reservations + event tickets. ✅ (schema + screen)
- **SMS campaigns:** segment (tier / VIP / recent / ❓ custom phone list),
  compose with **live character counter** (including the restaurant name +
  signature), send via mnotify, per-customer send status, history. 🛠 basic
  send exists; segments/counter/history to add.
- **One sender ID for all venues** — messages always brand with the venue
  name inside the body. ✅/❓ (mnotify sender ID per account — verify mnotify
  policy: some providers require sender ID registration per brand; fallback:
  one shared ID + branded body is the standard practice)
- Opt-out: STOP reply suppresses future sends (provider-level where
  supported, else suppression list). ➕

## 5.7 Inventory — owner-friendly intake, outflow classification & reconciliation

**Why.** The person doing inventory is the owner themselves, on a phone, often
after hours. Excel flows break them — they avoid a zone they don't have
expertise in — so stock never gets updated and "is my stock accurate?" can't
be answered. Two promises:
1. **Getting stock IN must be near-zero-effort** (photo of the receipt, or a
   30-second mobile entry).
2. **The system answers "does what left match what should have left?" from
   home**, knowing that not everything that leaves is a sale.

### 5.7.1 Intake — what goes IN (➕)

**Photo intake of receipts/invoices (➕, the owner's #1 wish).**
- Owner photographs the supplier receipt/invoice → photo is **always saved**
  as a purchase record (never lost, E-I1) → the system proposes stock-in
  lines (item, qty, unit cost, supplier, date).
- Owner confirms or corrects on the phone before it lands in stock.
- ❓ Extraction engine: **v1 = the app proposes lines by matching known
  products + free-text for new ones** (cheap, reliable); full OCR comes later
  (v1.5). Camera-to-photo is the v1 deliverable; the photo is the record.

**Manual quick-add (➕).** One screen, one line = item + qty + cost (+ supplier
optional). Built for "bought 10 crates of mineral today" — 30 seconds, no
spreadsheet, no expertise. Same flow on the phone app (PWA ✅ / native later).

### 5.7.2 Outflow — everything that leaves is classified (➕)

Every stock decrement carries a reason bucket — nothing leaves silently
(Invariant 6):

| Bucket | Meaning | Wired to |
|---|---|---|
| `sale` | consumed by an order (deduct on `served` only — 5.3 recommendation) | `inventory_transactions` on served |
| `debt` | taken by a customer on credit — leaves stock but isn't a sale | customer profile + `outstanding_balance` RPC ✅ |
| `destroyed` | waste / spoilage / damage | spillage flow (2.5), schema ✅ |
| `other` | owner usage, inter-venue transfer, supplier short-ship | audit entry |

- Every outflow is a visible ledger row (who, when, why) — the ledger IS the
  truth (Invariant 6).
- Paying off a debt does **not** "un-leave" stock — it reconciles the
  customer's outstanding balance (E-I4).

### 5.7.3 End-of-day reconciliation — the "from home" view (➕)

**Nightly snapshot (cron, Batch 9):** for every item —
`expected remaining = previous balance + Σ intake − Σ outflow (sale+debt+destroyed)`.

**Stock-check screen:** per item — opened stock, intake today, sold, debt,
destroyed, expected remaining, **counted remaining** (the owner types what
they physically counted) → **variance**.

- Variance = 0 → ✅ "accurate".
- Variance ≠ 0 → the item is flagged with a drill-down to the exact ledger
  lines (every intake and outflow, timestamped, attributed). The owner decides
  (theft? miscount? short-ship?) and corrects with a `variance` adjustment
  (audited, becomes the new baseline — E-I3).
- Variance over a threshold (❓ venue setting, e.g. 2% or 1 unit) surfaces on
  LiveOps + optional nightly SMS to the owner.

**Edge cases.**
- E-I1: Blurry/unreadable receipt photo → photo still saved as a purchase
  record; owner adds lines manually later.
- E-I2: Sale deduction + waste must never double-count → deduct on `served`
  only; waste never re-deducts.
- E-I3: Counted at home ≠ venue count → owner picks the trusted count as the
  new baseline (variance adjustment); next snapshot starts from it.
- E-I4: Debt taken, paid later → debt stays as a ledger record; the payment
  reconciles the profile's outstanding balance.
- E-I5: Nightly snapshot missed (server down) → reconciliation recomputes
  from the last snapshot + ledger since (idempotent).

**Build order.** Manual quick-add + photo attach → outflow buckets (debt /
destroyed wires) → nightly snapshot + stock-check screen → variance flags →
photo line OCR (v1.5).

---

# BATCH 6 · SMS ARCHITECTURE

**Recommendation: one shared edge function `send-sms`** (purpose param), not
one per use-case.

**Why one function:**
- One place for provider config (mnotify), the sender ID, retries, rate
  limits, logging, and cost counters — a single pane for a paid resource.
- Callers stay dumb: webhook (payment confirm), food-ready, call-waiter
  fallback, campaign sender, OTP fallback — all call `send-sms`.
- Templates live in `_shared/sms.ts`; campaigns pass raw text.

**Contract:**
- `send-sms({ to, purpose, data? | text, venue_id })` where `purpose ∈`
  `food_ready | new_assignment | payment_receipt | call_waiter | campaign | otp`.
- **Dedupe** by `(purpose, entity_id, event)` — webhook retries must never
  double-send. ✅/➕ (mnotify-sms edge fn exists — audit its dedupe)
- **Rate & cost controls:** per-venue daily cap + per-minute burst cap;
  failures logged; LiveOps alert on provider failure.
- **Sender ID:** one shared ID for all venues (brand in the body). Verify
  mnotify's sender-ID registration policy — some require registration per
  brand; shared-ID + branded body is the standard fallback. ❓ confirm.

**When SMS is justified (cost rule):**
- ✅ waiter food-ready (they move around; Ghanaians respond to SMS),
- ❓ new-table assignment (optional, waiter is usually at the venue),
- ✅ payment receipt (opt-in), ✅ campaigns.
- ❌ never for customers sitting in the venue (they have the app + realtime).

# BATCH 7 · SOUNDS & NOTIFICATIONS

**Free, license-safe sources:** Mixkit, Pixabay Sounds, Freesound
(attribute where required). Download once → host in Supabase Storage
(public bucket) → play via Web Audio (`AudioContext`). Custom engineered
sound pack later, paid, same pipeline.

**Sound map (event → device → behaviour):**

| Event | Device | Behaviour |
|---|---|---|
| New order | Kitchen/bar (always-on) | loud distinct "ding", screen flash |
| Food ready | Waiter phone | loud "ready" + vibrate (+ SMS) |
| Call waiter | Waiter phone | loudest ping, full-screen banner + vibrate |
| Complaint | Waiter phone | medium ping + banner |
| Payment received | Waiter phone | soft ping |
| New assignment | Waiter phone | ping |
| Long-wait escalate | Manager (LiveOps) | ping + alert entry |

- Kitchen devices: keep screen awake (wake-lock API / OS setting). ➕
- iOS Safari limitation: audio needs a user gesture on first load — prime the
  AudioContext at login/session start. ➕
- Volume/disable toggle per event per device. ➕

# BATCH 8 · REALTIME VS BATCHING (data & scale)

**Live (realtime channels):** customer tracking, kitchen queue, waiter board,
LiveOps, payment status. ✅ channels exist — audit the publication list
(01-schema-and-logic.sql adds the needed tables ✅).

**Batched (every 10 min via cron):**
- Wait-time snapshots (avg per stage/station/hour) → `venue_metrics` table ➕
- Revenue / dwell / top-seller daily rollups ➕
- These feed reports + history so per-transition writes stay cheap.

**Rule:** transition timestamps write live (same trigger as the status),
everything aggregated is computed/derived on top. Never compute in the client
then write aggregates back as truth.

# BATCH 9 · CRON JOBS (inventory)

| Job | Cadence | Status |
|---|---|---|
| expire_stale_sessions (20-min no-order) | 1 min | ✅ |
| Orphan/empty bill sweep | 1 min | ✅ (migrate-expire-orphans) |
| Wait-time + revenue snapshots | 10 min | ➕ |
| Low-stock alerts | hourly | ➕ |
| Auto clock-out abandoned shifts | EOD | ✅ (migrate-auto-shifts) |
| Nightly stock reconciliation snapshot (5.7.3) | daily (00:05) | ➕ |
| Expire/close stale settling bills (paid + never closed, e.g. webhook missed) | hourly | ➕ |

---

# BATCH 10 · EDGE-CASE CATALOGUE (full behaviour)

1. **Re-scan after paying** → old session closed, fresh session + bill, empty
   cart, party prompt again. 🛠
2. **Add items after first order (pre-payment)** → same bill, new submission,
   no breakage. ✅ by design (audit proves it)
3. **Item unavailable at prep** → kitchen flags → bill recomputed server-side
   → customer + waiter notified → swap/void flow. ➕
4. **Spillage / waste** → inventory transaction, stock decremented, manager
   alert. ➕ (schema ✅)
5. **Customer taps "Cash"** → blocked server-side; waiter records the payment;
   without the waiter the bill never closes. ✅
6. **Popup opened, then closed** → nothing recorded, bill open, retry allowed. ✅
7. **Charge succeeded but callback/verify timed out** → webhook still closes
   the bill; customer sees "keep your receipt, we'll reconcile"; manager
   reconciliation list shows stragglers. 🛠
8. **Refund after closure** → payment `refunded`, bill reopens if under
   total, manager alerted. ➕
9. **Two waiters settle the same bill** → single-flight + server guard: second
   attempt rejected. 🛠
10. **20-min expiry with food on bill** → never auto-cancelled. ✅
11. **Waiter clocks out with assigned bills** → bills become unassigned; next
    eligible clock-in picks them up (or manager reassigns). ➕
12. **No eligible waiter at scan** → bill unassigned + manager alert, retry on
    clock-in. ➕
13. **Bar-only order** → kitchen queue untouched. 🛠 station bug
14. **PREPAY venue, unpaid order** → kitchen never sees it; payment tops up
    the same bill. 🛠
15. **Merged bill, partial payment** → both tables stay occupied until the
    combined total is covered. ➕
16. **Cart → order race with settling state** → submission rejected with
    "payment in progress". 🛠
17. **Modifiers priced but server ignores them** → server must recompute with
    `price_delta` (never trust the client's line total). 🛠 (verify RPC)
18. **Customer cancels while pending** → allowed, line removed, bill
    recomputed, kitchen sees it vanish. ➕
19. **Kitchen outage / order fails mid-submit** → empty submission rolled back,
    customer retries without duplicates. 🛠
20. **Currency/multi-venue** → every query venue-scoped; RLS verified. ✅

---

# APPENDIX · WORKING vs MISSING (consolidated)

| Area | Working today | Missing / broken |
|---|---|---|
| QR → session → bill | ✅ scan, create/resume, 20-min expiry cron | 🛠 re-scan after pay reuses old session |
| Waiter assignment | ✅ weighted, idempotent, party re-assign | ➕ no-waiter fallback + alert |
| Menu + cart | ✅ browse, cart, order submit | 🛠 modifiers never fetched; 🛠 cart not session-scoped |
| Order → kitchen | ✅ submission + realtime queue | 🛠 station routing (waiter orders → kitchen); 🛠 retry duplicates |
| Status chain | ✅ pending→served transitions | 🛠 no transition state machine; ➕ timestamps for wait time |
| Payment online | ✅ popup + verify + webhook + auto-close | 🛠 partial-payment gate; 🛠 fee split/subaccount; ➕ refunds; 🛠 channel map |
| Payment cash | ✅ waiter record + fee + ledger | 🛠 tendered/change not persisted; ➕ mark-settled button; 🛠 overpayment cap |
| Customer receipt | ✅ PNG | ❓ detailed variant |
| Call waiter / complaints | ➕ nothing | ➕ everything (button, ping, issue records, manager view, void/swap) |
| Kitchen sounds / waiters ping | ➕ nothing | ➕ sound + vibrate + SMS matrix |
| Kitchen waste/spillage | ✅ schema | ➕ UI + stock decrement + alerts |
| Waiter dashboard | ✅ tables, orders, invoice | 🛠 served button; ➕ realtime bill updates; 🛠 station bug |
| Table merge | ✅ schema columns | ➕ merge/unmerge RPC + UI (verify RPC existence) |
| Manager LiveOps | ✅ live occupancy/revenue/fees read | ➕ mark-settled, alerts feed, wait-time, dead buttons |
| Floorplan | ✅ read-only + QR | ➕ table CRUD |
| Menu & inventory mgmt | ✅ inventory CRUD | ➕ product/category/modifier CRUD, on/off wiring to customer menu; ➕ owner intake (receipt photo + quick-add), outflow buckets (sale/debt/destroyed), nightly reconciliation (5.7) |
| Staff mgmt | ✅ CRUD + shifts + approval | ❓ PIN vs OTP login gap |
| Finance | ✅ real math | 🛠 expense-month, custom-range, export bugs |
| CRM | ✅ profiles, SMS send | ➕ segments, char counter, opt-out, history |
| Reservations | ✅ end-to-end | ➕ extras |
| SMS | ✅ mnotify edge fn | ➕ shared send-sms, dedupe, caps, sender-ID policy |
| Sounds | ➕ nothing | ➕ asset hosting + playback pipeline |

---

# NEXT STEP · AUDIT

Once this document is agreed, produce `AUDIT.md`: every numbered item above →
its implementation (file:line / SQL / edge fn) → status → prioritized fix
list. **No architecture rewrites** — gap fixes only on the existing base.



