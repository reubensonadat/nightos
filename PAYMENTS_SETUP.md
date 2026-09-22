# Payment Infrastructure Setup Runbook

The payment **code is already built**. This runbook provisions the operational layer: secrets, deployments, and webhook registration. Complete all steps in order.

---

## Architecture (already implemented)

```
Customer browser                    Supabase Edge                     Paystack
─────────────────                   ──────────────                    ────────
PaystackButton.tsx
  └─ Popup SDK charge ──────────────────────────────────────────────▶ charge
       callback(reference)
         └─ api.verifyPayment() ──▶ verify-payment/index.ts
                                   └─ GET /transaction/verify ─────▶ verify
                                   └─ amount gate + idempotent insert
                                   └─ payments row → DB trigger closes bill

Paystack servers
  └─ charge.success webhook ─────▶ paystack-webhook/index.ts
                                   └─ HMAC-SHA-512 signature check
                                   └─ same amount gate + idempotent insert
                                   └─ refund events reopen bills
```

Key invariants (do not weaken):
- **Amounts are server-computed.** Remaining balance comes from `_shared/fees.ts` + the `bills` row — never from the client.
- **Idempotency is atomic.** `UNIQUE(payments.reference)` makes racing `verify-payment` / webhook calls safe (only one credits the bill).
- **The webhook verifies the HMAC-SHA-512 signature** before touching the database.
- **Secrets never reach the browser.** `sk_*` keys live only in Edge Function secrets.

---

## Step 0 — Prerequisites

- Paystack account: <https://dashboard.paystack.com> (Ghana region)
- Supabase CLI logged in: `npx supabase login`
- A deployed Supabase project (note its `PROJECT_REF` from Dashboard → Settings → API)

## Step 1 — Apply the database schema

`bills`, `payments`, `payment_events`, the unique constraints, and the
auto-close trigger all live in the schema SQL. Apply it if not already run:

```bash
# Dashboard → SQL Editor → paste supabase/01-schema-and-logic.sql → Run
# (or) link the project and push:
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Verify the payment-critical constraints exist:

```sql
SELECT indexname FROM pg_indexes
 WHERE indexname IN ('payments_reference_key',
                     'payment_events_paystack_reference_key');
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_payments_auto_close';
```

## Step 2 — Set Edge Function secrets

Dashboard → Edge Functions → Secrets (or CLI). These are server-only:

```bash
npx supabase secrets set \
  PAYSTACK_SECRET_KEY=sk_test_YOUR_TEST_SECRET \
  SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ_YOUR_SERVICE_ROLE_KEY
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are usually pre-set by Supabase —
setting them explicitly is harmless and makes the dependency visible.

## Step 3 — Deploy the edge functions

```bash
npx supabase functions deploy verify-payment
# The webhook is called by Paystack servers with no Supabase JWT:
npx supabase functions deploy paystack-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is **required** — Paystack cannot attach your
Supabase JWT. The function protects itself with the HMAC signature check.

## Step 4 — Register the webhook in Paystack

Dashboard → Settings → API Keys & Webhooks → Webhook URL:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
```

Enable at minimum: `charge.success`, `charge.refund`, `refund.processed`.

## Step 5 — Frontend environment

Copy [`.env.example`](.env.example) to `.env` and fill in:

| Variable | Value | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` | browser |
| `VITE_SUPABASE_ANON_KEY` | anon public key | browser |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_test_...` | browser (dev) |
| `VITE_PAYSTACK_LIVE_KEY` | `pk_live_...` (blank until go-live) | browser (prod) |

`PaystackButton` picks the key based on `import.meta.env.PROD` and refuses to
open the popup if it's missing or a placeholder — no silent failures.

## Step 6 — Test the full loop (test mode)

1. Use Paystack test cards: `4084 0840 8408 4081` (success) / `4084 0000 0000 4081` (insufficient funds). Test MoMo numbers are listed at <https://paystack.com/docs/payments/test-payments>.
2. Open a bill at a table, choose Card/MoMo, pay.
3. **Expected:** popup closes → `verify-payment` credits → bill flips to `settling`/`paid` → receipt available.
4. Check the audit trail:

```sql
SELECT paystack_reference, event_type, amount_pesewas, created_at
  FROM payment_events ORDER BY created_at DESC LIMIT 10;
```

5. **Idempotency test:** re-run `verify-payment` for the same reference (curl
   the function URL with the same `{ reference, bill_id }`). It must return
   `{ "deduped": true }` and the bill's `amount_paid` must not increase.
6. **Webhook test:** Dashboard → Webhooks → send a test event, then confirm a
   `charge.success` row appears in `payment_events`.

## Step 7 — Go live

1. Complete Paystack business verification (GH registration + settlement bank account).
2. Swap secrets: `PAYSTACK_SECRET_KEY=sk_live_...` (`npx supabase secrets set ...`).
3. Set `VITE_PAYSTACK_LIVE_KEY=pk_live_...` in your Cloudflare Pages production env.
4. Re-run Step 6 with a real GHS 1 transaction, then refund it from the Paystack
   dashboard and confirm the bill reopens (`charge.refund` path).

## Failure modes & guarantees

| Scenario | Behavior |
|---|---|
| Webhook arrives before popup callback | Either order works — both paths hit the same unique constraint; loser dedupes |
| Customer closes popup, pays nothing | No callback, no verify call, bill untouched |
| Forged/low-amount transaction | Amount gate rejects; logged as `amount_mismatch_rejected` |
| Webhook replay | Signature passes, insert dedupes, no double credit |
| Refund issued in Paystack | Payment marked `refunded`; bill reopens if under total |
| Edge function secrets missing | Functions return 500/401 — never partially credit |
