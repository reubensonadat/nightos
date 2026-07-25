import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import {
  OrderTrackingScreen,
  type OrderSummary,
} from "./screens/OrderTrackingScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { ReservationsScreen } from "./screens/ReservationsScreen";

// Waiter imports
import { StaffAuthScreen } from "./screens/waiter/StaffAuthScreen";
import { TablesDashboard, type Table } from "./screens/waiter/TablesDashboard";
import { OrderManagementScreen } from "./screens/waiter/OrderManagementScreen";
import { TableOperationsScreen } from "./screens/waiter/TableOperationsScreen";
import { InvoiceSettlementScreen } from "./screens/waiter/InvoiceSettlementScreen";
import { ShiftPerformanceScreen } from "./screens/waiter/ShiftPerformanceScreen";

// Kitchen imports
import { KitchenDisplayScreen } from "./screens/kitchen/KitchenDisplayScreen";

// Manager imports
import {
  AdminLoginScreen,
  ManagerShell,
  type ManagerPage,
} from "./screens/manager/ManagerShell";
import { LiveOpsScreen } from "./screens/manager/LiveOpsScreen";
import { FloorplanScreen } from "./screens/manager/FloorplanScreen";
import { MenuManagerScreen } from "./screens/manager/MenuManagerScreen";
import { StaffManagerScreen } from "./screens/manager/StaffManagerScreen";
import { FinancialReportsScreen } from "./screens/manager/FinancialReportsScreen";
import { CrmScreen } from "./screens/manager/CrmScreen";

type CustomerScreen =
  | "welcome"
  | "menu"
  | "cart"
  | "tracking"
  | "checkout"
  | "reservations";

type WaiterScreen =
  | "auth"
  | "dashboard"
  | "order"
  | "ops"
  | "invoice"
  | "shift";

type Mode = "customer" | "waiter" | "kitchen" | "manager";

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Sync mode from URL hash on mount
  const getModeFromPath = (): Mode => {
    const path = location.pathname.replace(/^\/+/, "").split("/")[0];
    if (path === "waiter") return "waiter";
    if (path === "kitchen") return "kitchen";
    if (path === "manager") return "manager";
    return "customer";
  };

  const [mode, setMode] = useState<Mode>(getModeFromPath);
  const [screen, setScreen] = useState<CustomerScreen>("welcome");
  const [lastOrder, setLastOrder] = useState<OrderSummary | null>(null);

  // Waiter state
  const [waiterScreen, setWaiterScreen] = useState<WaiterScreen>("auth");
  const [staffName, setStaffName] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Manager state
  const [managerAuthed, setManagerAuthed] = useState(false);
  const [managerName, setManagerName] = useState("");
  const [managerPage, setManagerPage] = useState<ManagerPage>("ops");

  // Sync URL when mode changes
  useEffect(() => {
    const paths: Record<Mode, string> = {
      customer: "/",
      waiter: "/waiter",
      kitchen: "/kitchen",
      manager: "/manager",
    };
    if (location.pathname !== paths[mode]) {
      navigate(paths[mode], { replace: true });
    }
  }, [mode, navigate, location.pathname]);

  /* ── Mode switchers ── */
  const switchToWaiter = () => {
    setMode("waiter");
    setWaiterScreen("auth");
  };

  const switchToKitchen = () => {
    setMode("kitchen");
  };

  const switchToManager = () => {
    setMode("manager");
    setManagerAuthed(false);
    setManagerPage("ops");
  };

  const switchToCustomer = () => {
    setMode("customer");
    setScreen("welcome");
    setStaffName("");
    setSelectedTable(null);
    setManagerAuthed(false);
    setManagerName("");
  };

  return (
    <CartProvider>
      {/* ═══════════════════════════════════════════════════════════
          CUSTOMER MODE
        ═══════════════════════════════════════════════════════════ */}
      {mode === "customer" && (
        <>
          {screen === "welcome" && (
            <WelcomeScreen
              onEnter={() => setScreen("menu")}
              onViewReservations={() => setScreen("reservations")}
              onStaffPortal={switchToWaiter}
              onKitchenDisplay={switchToKitchen}
              onManagerPortal={switchToManager}
            />
          )}

          {screen === "menu" && (
            <MenuScreen
              onBack={() => setScreen("welcome")}
              onViewCart={() => setScreen("cart")}
            />
          )}

          {screen === "cart" && (
            <CartScreen
              onBack={() => setScreen("menu")}
              onContinueShopping={() => setScreen("menu")}
              onOrderSent={(order) => {
                setLastOrder(order);
                setScreen("tracking");
              }}
            />
          )}

          {screen === "tracking" && lastOrder && (
            <OrderTrackingScreen
              order={lastOrder}
              onBackToMenu={() => setScreen("menu")}
              onPayBill={() => setScreen("checkout")}
            />
          )}

          {screen === "checkout" && lastOrder && (
            <CheckoutScreen
              total={lastOrder.total}
              onBack={() => setScreen("tracking")}
              onPaid={() => setScreen("welcome")}
            />
          )}

          {screen === "reservations" && (
            <ReservationsScreen onBack={() => setScreen("welcome")} />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          WAITER MODE
        ═══════════════════════════════════════════════════════════ */}
      {mode === "waiter" && (
        <>
          {waiterScreen === "auth" && (
            <StaffAuthScreen
              onSignIn={(name) => {
                setStaffName(name);
                setWaiterScreen("dashboard");
              }}
            />
          )}

          {waiterScreen === "dashboard" && (
            <TablesDashboard
              staffName={staffName}
              onSelectTable={(table) => {
                setSelectedTable(table);
                setWaiterScreen("order");
              }}
              onSignOut={switchToCustomer}
              onViewShift={() => setWaiterScreen("shift")}
            />
          )}

          {waiterScreen === "order" && selectedTable && (
            <OrderManagementScreen
              table={selectedTable}
              onBack={() => setWaiterScreen("dashboard")}
              onGoToTableOps={() => setWaiterScreen("ops")}
              onGoToInvoice={() => setWaiterScreen("invoice")}
            />
          )}

          {waiterScreen === "ops" && selectedTable && (
            <TableOperationsScreen
              table={selectedTable}
              onBack={() => setWaiterScreen("order")}
            />
          )}

          {waiterScreen === "invoice" && selectedTable && (
            <InvoiceSettlementScreen
              table={selectedTable}
              onBack={() => setWaiterScreen("order")}
              onSettled={() => setWaiterScreen("dashboard")}
            />
          )}

          {waiterScreen === "shift" && (
            <ShiftPerformanceScreen
              staffName={staffName}
              onBack={() => setWaiterScreen("dashboard")}
            />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          KITCHEN MODE (KDS)
        ═══════════════════════════════════════════════════════════ */}
      {mode === "kitchen" && (
        <KitchenDisplayScreen onExit={switchToCustomer} />
      )}

      {/* ═══════════════════════════════════════════════════════════
          MANAGER MODE (Desktop Dashboard)
        ═══════════════════════════════════════════════════════════ */}
      {mode === "manager" && (
        <>
          {!managerAuthed ? (
            <AdminLoginScreen
              onSignIn={(name) => {
                setManagerName(name);
                setManagerAuthed(true);
              }}
            />
          ) : (
            <ManagerShell
              managerName={managerName}
              activePage={managerPage}
              onPageChange={setManagerPage}
              onSignOut={switchToCustomer}
            >
              {managerPage === "ops" && <LiveOpsScreen />}
              {managerPage === "floorplan" && <FloorplanScreen />}
              {managerPage === "menu" && <MenuManagerScreen />}
              {managerPage === "staff" && <StaffManagerScreen />}
              {managerPage === "finance" && <FinancialReportsScreen />}
              {managerPage === "crm" && <CrmScreen />}
            </ManagerShell>
          )}
        </>
      )}
    </CartProvider>
  );
}

export default App;
