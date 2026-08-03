# Project TODOs

## Staff Auth & Session Management
- [ ] Implement persistent session management for staff members (Waiters, Kitchen, Admins). Currently, staff state is kept in local React state and is lost on page refresh.

## Waiter Dashboard
- [ ] **Table Context Passing**: Currently, when navigating to `/staff/table/:tableId/*`, the full `Table` object is passed via React Router `location.state`. This is fast but breaks if the user reloads the page directly or bookmarks the URL (since the state bundle is lost). *To fix this*: Implement a database lookup based on the `:tableId` in the URL so the screen can independently fetch its own data on load.

- [ ] Implement Waiter Dashboard UI changes (ongoing)

## Known Issues / Tech Debt
- [ ] 
