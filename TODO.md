# Project TODOs

## Shift Report & POS Transaction History
- [ ] **Dedicated Transaction History Page**: Make the Shift Report page a dedicated transaction history and shift audit interface.
  - [ ] **Waiter Attribution & Filtering**: Track and attribute each transaction/order to the handling waiter/bar staff member. Support sorting and filtering by waiter (view waiter name, orders handled, order items, cash vs. digital payments collected).
  - [ ] **Evening Cash Flow Summary**: Render a comprehensive bottom summary section showing total cash flow, digital payments, floats, and net cash drawer balancing for the evening/shift.
  - [ ] **Shift Inventory Logging & Reconciliation**: Reintroduce evening inventory logging where managers/bar staff log starting drink stock at the beginning of the shift (e.g., 20 bottles), track sold quantities from POS orders, and reconcile remaining stock on the end-of-shift report.
  - [ ] **Shift Report Overview Cleanup / Trimming**: Remove redundant overview widgets from the Shift Report screen:
    - [ ] Remove "Payment Methods" card preview
    - [ ] Remove "Top Floor Staff" leaderboard card preview
    - [ ] Remove secondary metrics pills row ("Net Subtotal", "VAT Collected", "Platform Fee", "Service Charge")

## Table Reservations & Nightclub Minimum Spend
- [ ] **Table Minimum Spend & Reservation Fee (~GHS 2,000+)**: Configure table booking rules for the nightclub's 7–8 tables with minimum reservation fees (GHS 2,000+ upwards based on table tier).
  - [ ] Track drink orders placed at booked tables against their reservation minimum spend balance.

## Staff Auth & Session Management
- [ ] Implement persistent session management for staff members (Waiters, Kitchen, Admins). Currently, staff state is kept in local React state and is lost on page refresh.

## Waiter Dashboard
- [ ] **Table Context Passing**: Currently, when navigating to `/staff/table/:tableId/*`, the full `Table` object is passed via React Router `location.state`. This is fast but breaks if the user reloads the page directly or bookmarks the URL (since the state bundle is lost). *To fix this*: Implement a database lookup based on the `:tableId` in the URL so the screen can independently fetch its own data on load.
- [ ] Implement Waiter Dashboard UI changes (ongoing)

## Known Issues / Tech Debt
- [ ] 

