import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { ProtectedRoute, VenueRequired } from "./screens/auth/ProtectedRoute";
import { AuthScreen } from "./screens/auth/AuthScreen";
import { VerifyOtpScreen } from "./screens/auth/VerifyOtpScreen";
import { VenueSetupScreen } from "./screens/auth/VenueSetupScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { ReservationsScreen } from "./screens/ReservationsScreen";
import { type OrderSummary } from "./screens/OrderTrackingScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { CustomerBottomNav } from "./components/CustomerBottomNav";

import { StaffAuthScreen } from "./screens/waiter/StaffAuthScreen";
import { TablesDashboard, type Table } from "./screens/waiter/TablesDashboard";
import { OrderManagementScreen } from "./screens/waiter/OrderManagementScreen";
import { TableOperationsScreen } from "./screens/waiter/TableOperationsScreen";
import { InvoiceSettlementScreen } from "./screens/waiter/InvoiceSettlementScreen";
import { ShiftPerformanceScreen } from "./screens/waiter/ShiftPerformanceScreen";

import { KitchenDisplayScreen } from "./screens/kitchen/KitchenDisplayScreen";

import {
  ManagerShell,
  type ManagerPage,
} from "./screens/manager/ManagerShell";
import { LiveOpsScreen } from "./screens/manager/LiveOpsScreen";
import { FloorplanScreen } from "./screens/manager/FloorplanScreen";
import { MenuManagerScreen } from "./screens/manager/MenuManagerScreen";
import { StaffManagerScreen } from "./screens/manager/StaffManagerScreen";
import { FinancialReportsScreen } from "./screens/manager/FinancialReportsScreen";
import { CrmScreen } from "./screens/manager/CrmScreen";
import { useVenue } from "./hooks/useVenue";

type NavTab = "menu" | "cart" | "orders";

type WaiterScreen =
  | "auth"
  | "dashboard"
  | "order"
  | "ops"
  | "invoice"
  | "shift";

type Mode = "customer" | "waiter" | "kitchen" | "manager";

/* ──────────────────── Customer Shell (bottom nav) ──────────────────── */

function CustomerShell({ venueId }: { venueId: string }) {
  const [tab, setTab] = useState<NavTab>("menu");
  const [activeOrders, setActiveOrders] = useState<OrderSummary[]>([]);
  const [history, setHistory] = useState<OrderSummary[]>([]);
  const [payingOrder, setPayingOrder] = useState<OrderSummary | null>(null);
  const { itemCount } = useCart();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nightos:orders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.active) setActiveOrders(parsed.active);
        if (parsed.past) setHistory(parsed.past);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("nightos:orders", JSON.stringify({ active: activeOrders, past: history })); } catch {}
  }, [activeOrders, history]);

  const handleOrderSent = useCallback((order: OrderSummary) => {
    setActiveOrders((prev) => [...prev, order]);
    setTab("orders");
  }, []);

  const handlePaid = useCallback(() => {
    if (!payingOrder) return;
    setHistory((prev) => [payingOrder, ...prev]);
    setActiveOrders((prev) => prev.filter((o) => o.orderNumber !== payingOrder.orderNumber));
    setPayingOrder(null);
  }, [payingOrder]);

  if (payingOrder) {
    return (
      <CheckoutScreen
        total={payingOrder.total}
        billId={payingOrder.billId || ""}
        venueId={payingOrder.venueId || venueId}
        onBack={() => setPayingOrder(null)}
        onPaid={handlePaid}
      />
    );
  }

  return (
    <div className="min-h-svh bg-isabelline">
      {tab === "menu" && <MenuScreen venueId={venueId} onViewCart={() => setTab("cart")} />}
      {tab === "cart" && <CartScreen venueId={venueId} onOrderSent={handleOrderSent} />}
      {tab === "orders" && (
        <OrdersScreen
          activeOrders={activeOrders}
          history={history}
          onPayBill={setPayingOrder}
        />
      )}
      <CustomerBottomNav activeTab={tab} onTabChange={setTab} cartCount={itemCount} />
    </div>
  );
}

/* ──────────────────── Customer Flow ──────────────────── */

function CustomerFlow({ onSwitchMode, venueId }: { onSwitchMode: (m: Mode) => void; venueId: string }) {
  const [inShell, setInShell] = useState(false);

  if (!inShell) {
    return (
      <WelcomeScreen
        onEnter={() => setInShell(true)}
        onStaffPortal={() => onSwitchMode("waiter")}
        onKitchenDisplay={() => onSwitchMode("kitchen")}
        onManagerPortal={() => onSwitchMode("manager")}
      />
    );
  }

  return <CustomerShell venueId={venueId} />;
}

/* ──────────────────── App Shell ──────────────────── */

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const { venue: loadedVenue } = useVenue("velvet-lounge");
  const venueId = loadedVenue.id;

  const getModeFromPath = (): Mode => {
    const path = location.pathname.replace(/^\/+/, "").split("/")[0];
    if (path === "waiter") return "waiter";
    if (path === "kitchen") return "kitchen";
    if (path === "manager") return "manager";
    return "customer";
  };

  const [mode, setMode] = useState<Mode>(getModeFromPath);

  const [waiterScreen, setWaiterScreen] = useState<WaiterScreen>("auth");
  const [staffName, setStaffName] = useState<string>("");
  const [staffVenueId, setStaffVenueId] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const [managerPage, setManagerPage] = useState<ManagerPage>("ops");

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

  const switchToWaiter = () => { setMode("waiter"); setWaiterScreen("auth"); };
  const switchToKitchen = () => { setMode("kitchen"); };
  const switchToManager = () => { setMode("manager"); };
  const switchToCustomer = () => {
    setMode("customer");
    setStaffName("");
    setStaffVenueId("");
    setSelectedTable(null);
  };

  return (
    <CartProvider>
      {mode === "customer" && (
        <CustomerFlow onSwitchMode={setMode} venueId={venueId} />
      )}

      {mode === "waiter" && (
        <>
          {waiterScreen === "auth" && (
            <StaffAuthScreen
              onSignIn={(name, vId) => {
                setStaffName(name);
                setStaffVenueId(vId);
                setWaiterScreen("dashboard");
              }}
            />
          )}
          {waiterScreen === "dashboard" && (
            <TablesDashboard
              venueId={staffVenueId}
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

      {mode === "kitchen" && (
        <KitchenDisplayScreen venueId={venueId} onExit={switchToCustomer} />
      )}

      {mode === "manager" && (
        <ProtectedRoute>
          <VenueRequired>
            <ManagerShell
              managerName={user?.email?.split("@")[0] || "Manager"}
              activePage={managerPage}
              onPageChange={setManagerPage}
              onSignOut={() => navigate("/login")}
            >
              {managerPage === "ops" && <LiveOpsScreen />}
              {managerPage === "floorplan" && <FloorplanScreen />}
              {managerPage === "menu" && <MenuManagerScreen />}
              {managerPage === "staff" && <StaffManagerScreen />}
              {managerPage === "finance" && <FinancialReportsScreen />}
              {managerPage === "crm" && <CrmScreen />}
            </ManagerShell>
          </VenueRequired>
        </ProtectedRoute>
      )}
    </CartProvider>
  );
}

function App() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </NetworkProvider>
  );
}

function AppRoutes() {
  const location = useLocation();

  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";
  const isVerifyRoute = location.pathname === "/verify-otp";
  const isSetupRoute = location.pathname === "/setup";

  if (isAuthRoute) {
    return <AuthScreen initialMode={location.pathname === "/signup" ? "signup" : "login"} />;
  }
  if (isVerifyRoute) return <VerifyOtpScreen />;
  if (isSetupRoute) return <VenueSetupScreen />;

  return <AppShell />;
}

export default App;
