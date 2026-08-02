import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { ProtectedRoute, VenueRequired } from "./screens/auth/ProtectedRoute";
import { AuthScreen } from "./screens/auth/AuthScreen";
import { VerifyOtpScreen } from "./screens/auth/VerifyOtpScreen";
import { VenueSetupScreen } from "./screens/auth/VenueSetupScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
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

type NavTab = "menu" | "tab" | "orders";

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
  const navigate = useNavigate();
  const location = useLocation();
  const tab = (location.pathname.replace(/^\/+/, "") as NavTab) || "menu";

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
    navigate("/orders");
  }, [navigate]);

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
      <Routes>
        <Route path="menu" element={<MenuScreen venueId={venueId} onViewCart={() => navigate("/tab")} />} />
        <Route path="tab" element={<CartScreen venueId={venueId} onOrderSent={handleOrderSent} onBack={() => navigate("/menu")} />} />
        <Route path="orders" element={
          <OrdersScreen
            activeOrders={activeOrders}
            history={history}
            onPayBill={setPayingOrder}
          />
        } />
        {/* Fallback to menu if directly accessing shell route */}
        <Route path="*" element={<MenuScreen venueId={venueId} onViewCart={() => navigate("/tab")} />} />
      </Routes>
      <CustomerBottomNav activeTab={tab} onTabChange={(t) => navigate(`/${t}`)} cartCount={itemCount} />
    </div>
  );
}

/* ──────────────────── Customer Flow ──────────────────── */

function CustomerFlow({ onSwitchMode, venueId }: { onSwitchMode: (m: Mode) => void; venueId: string }) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/home" element={
        <HomeScreen
          onEnter={() => navigate("/menu")}
          onStaffPortal={() => onSwitchMode("waiter")}
          onKitchenDisplay={() => onSwitchMode("kitchen")}
          onManagerPortal={() => onSwitchMode("manager")}
        />
      } />
      <Route path="/*" element={<CustomerShell venueId={venueId} />} />
    </Routes>
  );
}

/* ──────────────────── App Shell ──────────────────── */

function AppShell() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { venue: loadedVenue } = useVenue("velvet-lounge");
  const venueId = loadedVenue.id;

  const [waiterScreen, setWaiterScreen] = useState<WaiterScreen>("auth");
  const [staffName, setStaffName] = useState<string>("");
  const [staffVenueId, setStaffVenueId] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const [managerPage, setManagerPage] = useState<ManagerPage>("ops");

  const switchToCustomer = () => {
    navigate("/");
    setStaffName("");
    setStaffVenueId("");
    setSelectedTable(null);
  };

  const handleSwitchMode = (mode: Mode) => {
    navigate(`/${mode === 'customer' ? '' : mode}`);
  };

  return (
    <CartProvider>
      <Routes>
        <Route path="/waiter/*" element={
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
        </>} />

        <Route path="/kitchen/*" element={
        <KitchenDisplayScreen venueId={venueId} onExit={switchToCustomer} />
        } />

        <Route path="/manager/*" element={
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
        } />

        <Route path="/*" element={
          <CustomerFlow onSwitchMode={handleSwitchMode} venueId={venueId} />
        } />
      </Routes>
    </CartProvider>
  );
}

function App() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '13px', fontWeight: 600, borderRadius: '12px', padding: '12px 16px' },
            success: { iconTheme: { primary: '#23140C', secondary: '#FBF7F2' } },
            error: { iconTheme: { primary: '#DC2626', secondary: '#FEF2F2' } },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </NetworkProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthScreen initialMode="login" />} />
      <Route path="/signup" element={<AuthScreen initialMode="signup" />} />
      <Route path="/verify-otp" element={<VerifyOtpScreen />} />
      <Route path="/setup" element={<VenueSetupScreen />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}

export default App;
