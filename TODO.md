# Project TODOs

## Shift Report: Day's Detailed Transaction History & Audit
- [x] **Dedicated Daily Transaction History Hub**:
  - Make the Shift Report page the primary interface for inspecting the day's complete, detailed transaction history.
  - **Who Handled What & How Much**:
    - **Who**: Track and display the exact waiter/bartender/staff member who handled each order and payment.
    - **What**: Itemized breakdown of all items ordered, table/booth number, timestamp, and order status.
    - **How Much**: Exact monetary amounts per order, itemized line totals, and payment method (Cash vs. Mobile Money vs. Card).
  - **Filtering & Audit Controls**:
    - Filter/sort by waiter to audit individual staff shifts (orders taken, items delivered, total cash held, digital payments collected).
    - Search by order/bill reference, table number, or customer name.
- [x] **Tab Restructuring & Revamp**:
  - [x] **Set Detailed Transaction History as Default Landing View**: Dedicated transaction ledger with search, waiter, and payment filters.
  - [x] **Consolidate Payment & Waiter Breakdowns**: Merge payment method summaries and staff attribution directly into the Transaction History & Waiter Audit view.
  - [x] **Evening Cash Flow Summary & Balancing**: Render a comprehensive section showing total cash flow, digital payments, floats, and net cash drawer balancing for the shift.
  - [ ] **Shift Inventory Logging & Reconciliation**: Reintroduce evening inventory logging where managers/bar staff log starting drink stock at the beginning of the shift (e.g., 20 bottles), track sold quantities from POS orders, and reconcile remaining stock on the end-of-shift report.
  - [ ] **Staff "End Shift" Summary Flow**:
    - [ ] When a waiter/staff member clicks "End Shift", show them their individual shift report screen (orders handled, sales, cash collected, and audit metrics) before completing sign-out.
    - [ ] Allow bar staff/waiters to log what was sold and record final count on hand at shift close.

## Barman Responsibilities & Stock Handover
- [x] **Expanded Barman Workflow**:
  - [x] **Drink Allocation & Order Logging**: Barman is assigned the evening's drink stock with opening inventory gate, starting float input, and single priority drink queue to pour orders.
  - [x] **Shift Close Count**: End-of-shift count-out with variance calculation (expected vs counted bottles) and till cash audit for complete accountability.
  - [x] **Full Shift Report Access**: Bartenders can view the complete Manager Shift Report to audit waiters, track missing cash, and balance the drawer.

## Kitchen & Bar Station Fulfillment Mode Toggle
- [x] **Kitchen / Bar Display Mode Toggle**:
  - [x] Added venue setting/toggle on Manager Brand Settings to switch between dedicated Bar Station (Nightclubs & Lounges) and Kitchen KDS (Dining & Restaurants), defaulting to Bar Station.


## Manager Dashboard: Evening Stock & Real-Time Order Deductions
- [ ] **Clear Evening Stock Update Interface**:
  - [ ] Create a prominent, clear UI on the Manager Dashboard for logging/updating the evening's allocated drink inventory at the start of each night (e.g., set starting quantities for Hennessy, Tequila, Champagne, Beer, Mixers).
  - [ ] Quick-adjust buttons for rapid restocks during busy service hours.
- [ ] **Real-Time Order Stock Deductions**:
  - [ ] Automatically deduct from the evening's allocated stock with every order placed via POS or waiter.
  - [ ] Live remaining stock counters on the dashboard (`Remaining Evening Stock = Starting Stock - Quantity Ordered`).
  - [ ] Low stock alerts and "sold out" prevention badges when bottles reach depletion threshold.


## Table Reservations, Deposits & Spending Credits
- [ ] **Upfront Table Deposit (~GHS 2,000+)**:
  - [ ] Require an upfront table deposit fee (starting from GH₵ 2,000+ upwards depending on table tier/booth) when booking or opening any of the 7–8 nightclub tables.
  - [ ] **Table Spending Credit & Order Deductions**:
    - [ ] Every item/drink ordered at the table is deducted directly from the deposited balance (`Remaining Balance = Deposit Paid - Total Orders Value`).
    - [ ] Real-time tracking display for waiters and guests showing remaining credit to encourage spending up to the full deposit amount.
    - [ ] Overage handling: once the deposit is exhausted, additional orders accrue to the final bill.

## Informal Zones, Standing Areas & Walk-in Tabs
- [ ] **Informal Areas / Standing Zones Configuration**:
  - [ ] Support non-table zones (e.g., "Bar Rail", "Standing Lounge Pockets", "High Top Counters", "Dance Floor Rail") where groups (up to 10+ people) mingle without a reserved VIP booth.
  - [ ] **No Deposit / Minimum Spend Requirement**: Exempt informal zones from the mandatory VIP table deposit (~GH₵ 2,000+).
- [ ] **Quick Walk-up Orders & Floating Tabs**:
  - [ ] **Instant Pay-as-you-go (Direct Order)**: Waiter or bartender can punch in an order and immediately collect payment (Cash, MoMo, Card) on the spot without maintaining an open table bill.
  - [ ] **Named Floating Tabs**: For informal groups who want to run a tab, allow waiters to quickly open a tab tagged with a customer/group name or visual identifier (e.g., *"Standing Rail — Dave"*, *"Lounge Corner — Sarah's Group"*).
  - [ ] **Individual / Split Ordering**: Allow individuals within the informal group to order and settle their own drinks independently without locking the entire area.



## Staff Auth & Session Management
- [ ] Implement persistent session management for staff members (Waiters, Kitchen, Admins). Currently, staff state is kept in local React state and is lost on page refresh.

## Waiter Dashboard
- [ ] **Table Context Passing**: Currently, when navigating to `/staff/table/:tableId/*`, the full `Table` object is passed via React Router `location.state`. This is fast but breaks if the user reloads the page directly or bookmarks the URL (since the state bundle is lost). *To fix this*: Implement a database lookup based on the `:tableId` in the URL so the screen can independently fetch its own data on load.
- [ ] Implement Waiter Dashboard UI changes (ongoing)

## Known Issues / Tech Debt
- [ ] 

