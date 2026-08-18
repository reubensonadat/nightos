# Bysen — Central Login Implementation (AUTH)

> Spec + implementation plan for the single **central login** that serves every
> actor. Modelled on AXION's split-screen auth (the animation we love), with
> role-free login: the system figures out who you are, checks your venue and
> role, and routes you. No role picker, no locked-in personas.
>
> Also covers two changes from the flow review: **waiter ratings** and the
> **removal of the supervisor role**.
>
> Legend: ✅ exists · 🛠 adapt/fix · ➕ build · ❓ decision

---

## 1 · The experience (what the user sees)

### 1.1 Entry — `CentralLogin`

The first screen of the app. Split-screen, AXION-style:

- **Image panel (desktop, 50%)** — Bysen brand panel: logo, animated headline
  that swaps when toggling login ⇄ signup, subtle floating gradient, dark
  overlay for readability. Spring slide (damping ~25) swaps panels between
  login and signup. ✅/🛠 (AXION's `AuthShell` ported to Tailwind + our brand)
- **Form panel (50%)** — the active step, centered `max-w-md`, scrollable,
  theme-consistent (our isabelline/licorice palette). Mobile = full-width,
  logo top-left, no x-transform.

**Step machine (one screen, animated steps, no page jumps):**

```
                    ┌──────────────┐
        identifier  │  1 · Who are │
        (email |    │     you?     │  ← single input, auto-detects
         phone)     └──────┬───────┘
                           │
              ┌────────────┴─────────────┐
              ▼                          ▼
    ┌───────────────────┐      ┌───────────────────┐
    │ 2 · Email (owner/ │      │ 2 · Phone (staff) │
    │   manager)        │      │                    │
    │   password step   │      │   OTP step         │
    └─────────┬─────────┘      └─────────┬──────────┘
              │                          │
              ▼                          ▼
    ┌──────────────────────────────────────────────┐
    │ 3 · resolve_login(identifier)                 │
    │   → role + venue + destination                │
    │   → animate to destination dashboard          │
    └──────────────────────────────────────────────┘
```

### 1.2 Step 1 — Identifier (single input)

- One field: "Email or phone number".
- **Auto-detect:** contains `@` → email path; otherwise phone path
  (normalise `0…` → `+233…`).
- Continue button enabled when input looks valid (`email regex` /
  `≥ 9 digits`).
- ❓ **Google OAuth** — AXION has a placeholder. Decision: skip for v1
  (owners use email/password, staff use OTP — we control both identities;
  no OAuth needed yet).

### 1.3 Step 2 — Password (email) / OTP (phone)

- **Email** → password step: email + password + show/hide toggle + "Create
  one — it's free" link (animates to signup).
- **Phone** → OTP step: reuse `OtpInput` (exists ✅), 60s resend cooldown,
  4-min expiry, "Change number" back. ✅ (VerifyOtpScreen/StaffAuthScreen
  logic folds in here)

### 1.4 Step 3 — Role resolution & routing (the magic)

- After credentials verify, the client calls **`resolve_login(identifier)`**
  (new RPC, SECURITY DEFINER).
- It returns one of:

| Identity | Source | Route |
|---|---|---|
| Owner | `venues.owner_id = auth.uid()` | `/manager` |
| Manager | `staff.role='manager'` by phone/email | `/manager` |
| Waiter | `staff.role='waiter'` | `/waiter` |
| Kitchen / Bar | `staff.role` | `/kitchen` |
| No account | nothing found | → signup animation |

- ❓ One person, multiple staff rows (works at 2 venues): default = most
  recently active venue; a venue switcher appears in their app (v1.5 —
  multi-branch). RPC returns a list; client picks.
- **No role picker ever.** Log out → back to Step 1 → log in as anyone else.

### 1.5 No-account handling (the two-notification moment)

Flow when `resolve_login` finds nothing (or signIn returns "invalid login"):

1. Stay on the same screen (never a jarring error page).
2. **Toast 1 (immediate):** "No account found for that email/phone."
3. **Toast 2 (after ~1.2 s timer):** "Let's get you set up — create one in
   seconds."
4. The form **animates** (slide) into signup mode with the identifier
   pre-filled. ❓ signup scope v1: owners only (staff are created by
   managers, not self-signed). If the identifier was a phone → show
   "staff accounts are created by your manager" instead. Decision below.
5. **Race-condition removal:** the two toasts fire from a single state
   machine (`notFoundStage: 'idle' | 'first' | 'second'`) driven by one
   timer that is **cancelled and reset** on any user input, unmount, or
   retry — double-submits, stale timers, or overlapping signIn calls can
   never double-animate or double-toast.

### 1.6 Signup (owner)

- Name + email + password (+ phone optional) → creates Supabase auth user
  → creates the venue in `venues` (owner_id link) → lands on `/setup`
  (VenueSetupScreen ✅ exists — fold in) → done.

### 1.7 Race-condition rules (global auth invariants)

1. **Single-flight:** every step's submit button is disabled while its
   request is in flight; no double signIn/verifyOtp/sendOtp.
2. **One timer at a time:** all cooldowns/notifications are owned by a
   single effect per step; cleaned up on unmount and on re-entry.
3. **Token/OTP reuse:** a verified OTP can never be replayed (Supabase
   one-time tokens ✅); password submit after OTP send is blocked until
   expiry.
4. **Resolve is idempotent:** `resolve_login` is a pure read — calling it
   twice returns the same route.
5. **Route guards:** after login, ProtectedRoute re-checks the resolved
   role — you can never land on a dashboard you don't own by editing the
   URL.

## 2 · Persistence (log in once, stay in)

- Owner: Supabase session (persists ✅).
- Staff: `staffSession` is loaded at boot from the auth user's linked staff
  row (`staff.auth_user_id` or phone match) — **not** local component state.
  🛠 currently staffSession lives in React state and is lost on refresh —
  this is the "stuck to one role / re-login" pain point. Fix: on auth state
  change, look up the staff row and hydrate `staffSession` + `role`.
- Sign out clears both and returns to Step 1. ✅/🛠 (janitor sweep of
  `bysen:*` + `nightos:*` localStorage keys)

## 3 · DB & edge changes

1. ➕ `resolve_login(identifier text)` RPC (SECURITY DEFINER):
   - owner: `venues.owner_id = auth.uid()` → `{ role:'owner', venue }`
   - staff: match by `staff.phone` (normalised) or `staff.email`, `is_active`
     → `{ role, venue_id, staff_id, name, venue_name }`
   - none → `{ role: null }`
   - `GRANT EXECUTE TO authenticated`.
2. 🛠 **PIN vs OTP for staff** (FLOW.md decision = PIN; code = OTP). Central
   login uses OTP (number → OTP page — exactly what you asked for). PIN
   stays on the FLOW.md backlog; not required here.
3. ✅ phone OTP needs Supabase SMS provider configured (Twilio/MessageBird)
   + mnotify fallback ❓. Verify before demo — this is the one external
   dependency of staff login.
4. ➕ `waiter_ratings` table (below) + RLS (anyone can insert with a valid
   session token; only the venue can read).

## 4 · Waiter ratings (new, added to flow)

**Why.** After settling, the customer rates their waiter — reputation signal
that also feeds the manager dashboard.

**Table.**
```sql
create table public.waiter_ratings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  bill_id uuid not null references public.bills(id),
  waiter_id uuid not null references public.staff(id),
  rating smallint not null check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default now()
);
-- unique per bill so one settlement = one rating
alter table public.waiter_ratings add constraint
  waiter_ratings_bill_once unique (bill_id);
```

**Flow.**
1. After "Payment received" (online) or waiter settlement (cash), the
   customer's receipt screen offers **"Rate your waiter"** — 5 stars +
   optional note. ➕
2. One rating per bill (unique constraint — no re-rating, no double
   submits). The waiter's name shown comes from `bills.waiter_id`.
3. Waiter sees their own average in the **shift/performance screen**
   (ShiftPerformanceScreen ✅ — add rating card). ➕
4. Manager sees per-waiter averages in LiveOps + Staff Manager. ➕
5. Skip is allowed; never forced. Rating can't be changed after submit
   (v1 — keep it simple, refunds don't reset it ❓).

**Edge cases.**
- E-R1: Bill closed by webhook while the customer's app is closed → they
  simply don't rate; no nagging (only the one prompt on the receipt screen).
- E-R2: Merged bill → one rating for the paymaster bill's waiter.
- E-R3: Waiter clocks out before rating → rating still lands on their
  profile (bill's `waiter_id` is the record, not the live shift).

## 5 · Supervisor role — REMOVE

**Why.** The flow has no supervisor concept; manager = full control already.
The role adds confusion in the staff dropdown.

**Changes.**
1. `StaffManagerScreen.tsx:38` — remove `{ value: "supervisor", label:
   "Supervisor" }` from the role options.
2. `AuthContext.tsx:42` — `sectorPath` no longer needs the supervisor branch
   (harmless but delete for clarity).
3. `useManagerDashboard.ts:251` — `countRole(['waiter','supervisor'])` →
   `['waiter']`.
4. DB: `staff.role` CHECK constraint keeps `supervisor` for existing rows
   (no destructive migration) — new rows can't be created via UI anymore;
   ❓ decide whether to `ALTER` the enum later (cleanup migration, v1.5).
5. `api.ts:1147` — comment references supervisor as approver; role check
   there stays permissive (owner/manager) — just clean the comment.

> Note: `cashier` and `bartender` also appear in UI/data (StaffManagerScreen
> placeholder `role: "bartender"` at :124 is a **data bug** — `staff.role`
> has no `bartender` value; fix to `bar`).

---

## 6 · Build order (batches)

| # | Batch | Deliverable | Status |
|---|---|---|---|
| A | Auth shell + primitives | `AuthShell.tsx` (split-screen, spring slide), `AuthField.tsx` (TextField/PrimaryButton/ErrorBanner), reuse `OtpInput` | ➕ |
| B | Step machine | `IdentifierStep` → auto-detect → `PasswordStep` / `OtpStep`; `useAuthSteps` state machine (single-flight + one-timer rules) | ➕ |
| C | Role resolution | `resolve_login` RPC + `useResolveLogin` hook + routing by role (no picker) | ➕ |
| D | No-account flow | two-toast sequence with timer → animate to signup (owner-only signup; staff see "created by your manager") | ➕ |
| E | Persistence | staffSession hydrate on refresh; janitor sign-out sweep | 🛠 |
| F | Ratings + supervisor removal | `waiter_ratings` migration + rate UI + manager/waiter displays; role cleanup | ➕ |

**Dependencies:** A → B → D; C can start in parallel with A (DB work);
E depends on C; F is independent — can land any time.
