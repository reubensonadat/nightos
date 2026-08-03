import { useState, useEffect, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { CartProvider } from "./context/CartContext";
import { db } from "./lib/api";
import { ProtectedRoute, VenueRequired } from "./screens/auth/ProtectedRoute";
import { AuthScreen } from "./screens/auth/AuthScreen";
import { VerifyOtpScreen } from "./screens/auth/VerifyOtpScreen";
import { VenueSetupScreen } from "./screens/auth/VenueSetupScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { type OrderSummary } from "./screens/OrderTrackingScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { CustomerBottomNav } from "./components/CustomerBottomNav";
import { useTabComputed } from "./store/useTabStore";

import { StaffAuthScreen } from "./screens/waiter/StaffAuthScreen";
import { TablesDashboard, type Table } from "./screens/waiter/TablesDashboard";
import { OrderManagementScreen } from "./screens/waiter/OrderManagementScreen";
import { TableOperationsScreen } from "./screens/waiter/TableOperationsScreen";
import { InvoiceSettlementScreen } from "./screens/waiter/InvoiceSettlementScreen";
import { ShiftPerformanceScreen } from "./screens/waiter/ShiftPerformanceScreen";

import { KitchenDisplayScreen } from "./screens/kitchen/KitchenDisplayScreen";

import { ManagerShell, type ManagerPage } from "./screens/manager/ManagerShell";
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

/* ──────────────────── Customer Shell (bottom nav) ──────────────────── */

function CustomerShell({ venueId, tab }: { venueId: string; tab: NavTab }) {
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState<OrderSummary[]>([]);
  const [history, setHistory] = useState<OrderSummary[]>([]);
  const [payingOrder, setPayingOrder] = useState<OrderSummary | null>(null);
  const { cartItemCount: itemCount } = useTabComputed();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nightos:orders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.active) setActiveOrders(parsed.active);
        if (parsed.past) setHistory(parsed.past);
      }
    } catch (error) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "nightos:orders",
        JSON.stringify({ active: activeOrders, past: history }),
      );
    } catch (error) {
      // ignore
    }
  }, [activeOrders, history]);

  const handleOrderSent = useCallback(
    (order: OrderSummary) => {
      setActiveOrders((prev) => [...prev, order]);
      navigate("/orders");
    },
    [navigate],
  );

  const handlePaid = useCallback(() => {
    if (!payingOrder) return;
    setHistory((prev) => [payingOrder, ...prev]);
    setActiveOrders((prev) =>
      prev.filter((o) => o.orderNumber !== payingOrder.orderNumber),
    );
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
      {tab === "menu" && <MenuScreen venueId={venueId} onBack={() => navigate('/home')} />}
      {tab === "cart" && (
        <CartScreen venueId={venueId} onOrderSent={handleOrderSent} />
      )}
      {tab === "orders" && (
        <OrdersScreen
          activeOrders={activeOrders}
          history={history}
          onPayBill={setPayingOrder}
        />
      )}
      <CustomerBottomNav
        activeTab={tab}
        onTabChange={(newTab) => navigate(`/${newTab}`)}
        cartCount={itemCount}
      />
    </div>
  );
}

/* ──────────────────── Client Wrappers & Redirects ──────────────────── */

function CustomerRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/home", { replace: true });
  }, [navigate]);

  return <div className="min-h-svh bg-isabelline" />;
}

function WelcomeScreenWrapper() {
  const navigate = useNavigate();
  return (
    <WelcomeScreen />
  );
}

function HomeScreenWrapper() {
  const navigate = useNavigate();
  return (
    <HomeScreen
      onEnter={() => navigate("/menu")}
      onStaffPortal={() => navigate("/waiter")}
      onKitchenDisplay={() => navigate("/kitchen")}
      onManagerPortal={() => navigate("/manager")}
    />
  );
}

function CustomerRouteWrapper({ tab }: { tab: NavTab }) {
  // Hardcoded for now as token checking was removed
  return <CustomerShell venueId="velvet-lounge" tab={tab} />;
}

/* ──────────────────── Waiter Sub-Flow Wrapper ──────────────────── */

function WaiterWrapper() {
  const navigate = useNavigate();
  const [waiterScreen, setWaiterScreen] = useState<WaiterScreen>("auth");
  const [staffName, setStaffName] = useState<string>("");
  const [staffVenueId, setStaffVenueId] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const switchToCustomer = () => {
    navigate("/");
  };

  return (
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
  );
}

/* ──────────────────── Kitchen Wrapper ──────────────────── */

function KitchenWrapper() {
  const navigate = useNavigate();
  const { venue: loadedVenue } = useVenue("velvet-lounge");
  return (
    <KitchenDisplayScreen
      venueId={loadedVenue.id}
      onExit={() => navigate("/")}
    />
  );
}

/* ──────────────────── Manager Wrapper ──────────────────── */

function ManagerWrapper() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [managerPage, setManagerPage] = useState<ManagerPage>("ops");

  return (
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
  );
}

/* ──────────────────── App Routes & Core ──────────────────── */

function AppRoutes() {
  const location = useLocation();

  const isAuthRoute =
    location.pathname === "/login" || location.pathname === "/signup";
  const isVerifyRoute = location.pathname === "/verify-otp";
  const isSetupRoute = location.pathname === "/setup";

  if (isAuthRoute) {
    return (
      <AuthScreen
        initialMode={location.pathname === "/signup" ? "signup" : "login"}
      />
    );
  }
  if (isVerifyRoute) return <VerifyOtpScreen />;
  if (isSetupRoute) return <VenueSetupScreen />;

  return (
    <Routes>
      {/* Customer Routes */}
      <Route path="/" element={<CustomerRedirect />} />
      <Route path="/table/:tableId" element={<WelcomeScreenWrapper />} />
      <Route path="/home" element={<HomeScreenWrapper />} />
      <Route path="/menu" element={<CustomerRouteWrapper tab="menu" />} />
      <Route path="/cart" element={<CustomerRouteWrapper tab="cart" />} />
      <Route path="/orders" element={<CustomerRouteWrapper tab="orders" />} />

      {/* Staff Routes */}
      <Route path="/waiter" element={<WaiterWrapper />} />
      <Route path="/kitchen" element={<KitchenWrapper />} />
      <Route path="/manager" element={<ManagerWrapper />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </NetworkProvider>
  );
}

export default App;
