import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { useRealtime } from "./hooks/useRealtime";
import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { ProtectedRoute, VenueRequired } from "./screens/auth/ProtectedRoute";
import { AuthScreen } from "./screens/auth/AuthScreen";
import { VerifyOtpScreen } from "./screens/auth/VerifyOtpScreen";
import { VenueSetupScreen } from "./screens/auth/VenueSetupScreen";
import { LandingScreen } from "./screens/LandingScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { type OrderSummary } from "./screens/OrderTrackingScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { CustomerBottomNav } from "./components/CustomerBottomNav";
import { PartyPrompt } from "./components/PartyPrompt";
import { ClockIcon } from "@heroicons/react/24/outline";

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
import { ReservationsScreen } from "./screens/ReservationsScreen";
import { useVenue } from "./hooks/useVenue";
import { useQrTable } from "./hooks/useQrTable";
import { useCustomerSession } from "./hooks/useCustomerSession";
import { db, type DbTable, type DbStaffSession } from "./lib/api";

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

function CustomerShell({ venueId, tableId, tableLabel }: { venueId: string; tableId: string | null; tableLabel?: string | null }) {
  const [tab, setTab] = useState<NavTab>(() => {
    const saved = localStorage.getItem("nightos:customer:tab");
    return saved === "cart" || saved === "orders" ? saved : "menu";
  });
  const [activeOrders, setActiveOrders] = useState<OrderSummary[]>([]);
  const [history, setHistory] = useState<OrderSummary[]>([]);
  const [payingOrder, setPayingOrder] = useState<OrderSummary | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const { itemCount } = useCart();

  const { session, bill, waiter, loading: sessionLoading, error: sessionError, updateParty } = useCustomerSession(venueId, tableId);

  // One-time "how many of you?" prompt per session (QR tables only)
  const [partyPromptOpen, setPartyPromptOpen] = useState(false);
  useEffect(() => {
    if (!tableId || !session || partyPromptOpen) return;
    try {
      if (localStorage.getItem(`nightos:party:${session.id}`) === "1") return;
    } catch {}
    setPartyPromptOpen(true);
  }, [tableId, session, partyPromptOpen]);

  const handlePartyConfirm = useCallback(
    async (partySize: number, guestName?: string) => {
      const { error } = await updateParty(partySize, guestName);
      if (error) {
        toast.error(String(error));
        return;
      }
      try { localStorage.setItem(`nightos:party:${session?.id ?? ''}`, "1"); } catch {}
      setPartyPromptOpen(false);
    },
    [updateParty, session],
  );

  useEffect(() => {
    let cancelled = false;
    db.venueById(venueId)
      .then(
        ({ data }) => {
          if (!cancelled && data) setVenueName(data.name);
        },
        () => {},
      );
    return () => {
      cancelled = true;
    };
  }, [venueId]);

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

  // A new scan = a new visit: wipe the orders list unless we've already
  // marked THIS session (so a page refresh mid-visit keeps its orders).
  const sessionOrdersKey = session ? `nightos:orders:sid:${session.id}` : "";
  useEffect(() => {
    if (!session) return;
    try {
      const marked = localStorage.getItem(sessionOrdersKey) === "1";
      localStorage.setItem(sessionOrdersKey, "1");
      if (!marked) {
        setActiveOrders([]);
        setHistory([]);
      }
    } catch {}
  }, [sessionOrdersKey, session]);

  useEffect(() => {
    try { localStorage.setItem("nightos:customer:tab", tab); } catch {}
  }, [tab]);

  useEffect(() => {
    try { localStorage.setItem("nightos:orders", JSON.stringify({ active: activeOrders, past: history })); } catch {}
  }, [activeOrders, history]);

  // Live status: realtime streams pending→ready→served→cancelled
  // (anon kitchen policy covers every status, so no polling needed).
  const activeSubmissionIds = useMemo(
    () => activeOrders.filter((o) => o.submissionId).map((o) => o.submissionId as string),
    [activeOrders],
  );
  const refreshStatuses = useCallback(async () => {
    if (activeSubmissionIds.length === 0) return;
    const { data, error } = await db.orderSubmissionStatuses(activeSubmissionIds, session?.session_token);
    if (error || !data) return;
    const statusMap = new Map(data.map((d) => [d.id, d.status]));
    setActiveOrders((prev) => {
      const stillActive = prev.filter((o) => o.submissionId && statusMap.get(o.submissionId) !== "cancelled");
      const newlyCancelled = prev
        .filter((o) => o.submissionId && statusMap.get(o.submissionId) === "cancelled")
        .map((o) => ({ ...o, status: "cancelled" as const, cancelled: true }));
      if (newlyCancelled.length > 0) {
        queueMicrotask(() => setHistory((h) => [...newlyCancelled, ...h]));
      }
      return stillActive.map((o) => {
        const next = o.submissionId ? statusMap.get(o.submissionId) : undefined;
        return next && next !== o.status ? { ...o, status: next as OrderSummary['status'] } : o;
      });
    });
  }, [activeSubmissionIds, session?.session_token]);

  // Realtime: the customer's own submissions (events pass RLS for
  // every status via the anon kitchen policy).
  useRealtime({
    table: 'order_submissions',
    filter: bill?.id ? `bill_id=eq.${bill.id}` : undefined,
    onInsert: refreshStatuses,
    onUpdate: refreshStatuses,
    onDelete: refreshStatuses,
  });

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
        billId={bill?.id || payingOrder.billId || ""}
        venueId={payingOrder.venueId || venueId}
        sessionToken={session?.session_token}
        onBack={() => setPayingOrder(null)}
        onPaid={handlePaid}
      />
    );
  }

  if (tableId && session && session.status === "expired") {
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center px-8">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink/5">
            <ClockIcon className="h-7 w-7 text-ink/50" />
          </div>
          <p className="text-ink font-semibold text-lg">Session expired</p>
          <p className="text-ink/60 text-sm mt-1 leading-relaxed">
            This table's session at {venueName ?? "Velvet Lounge"} ({tableLabel ?? "this table"}) ended because no
            order was placed within 20 minutes. Re-scan the QR code on the table to start a fresh session.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-ink text-parchment rounded-full text-sm font-semibold"
          >
            Re-scan
          </button>
        </div>
      </div>
    );
  }

  if (tableId && (sessionLoading || sessionError || !session || !bill)) {
    if (sessionError) {
      return (
        <div className="min-h-svh bg-isabelline flex items-center justify-center px-8">
          <div className="text-center">
            <p className="text-ink font-semibold text-lg">Couldn't start your session</p>
            <p className="text-ink/60 text-sm mt-1">Please check your connection and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-3 bg-ink text-parchment rounded-full text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-isabelline">
      {tab === "menu" && (
        <MenuScreen
          venueId={venueId}
          venueName={venueName}
          tableLabel={tableLabel}
          waiterName={waiter?.name ?? null}
          onViewCart={() => setTab("cart")}
        />
      )}
      {tab === "cart" && (
        <CartScreen
          venueId={venueId}
          venueName={venueName ?? undefined}
          tableLabel={tableLabel ?? undefined}
          billId={bill?.id}
          customerSessionId={session?.id}
          sessionToken={session?.session_token}
          onBack={() => setTab("menu")}
          onOrderSent={handleOrderSent}
        />
      )}
      {tab === "orders" && (
        <OrdersScreen
          activeOrders={activeOrders}
          history={history}
          tableLabel={tableLabel}
          venueName={venueName}
          billId={bill?.id ?? null}
          sessionToken={session?.session_token}
          onPayBill={setPayingOrder}
        />
      )}
      <CustomerBottomNav activeTab={tab} onTabChange={setTab} cartCount={itemCount} />

      {partyPromptOpen && (
        <PartyPrompt
          venueName={venueName ?? "Velvet Lounge"}
          tableLabel={tableLabel}
          initialSize={session?.party_size ?? 1}
          onConfirm={handlePartyConfirm}
        />
      )}
    </div>
  );
}

/* ──────────────────── Customer Flow ──────────────────── */

type CustomerFlowProps = {
  onSwitchMode: (m: Mode) => void;
  venueId: string;
  qrTable: DbTable | null;
  qrLoading: boolean;
  qrError: boolean;
};

function CustomerFlow({ onSwitchMode, venueId, qrTable, qrLoading, qrError }: CustomerFlowProps) {
  // Per-visit only (never persisted): the "Customer" card on the landing hub
  const [inShell, setInShell] = useState(false);
  const [showReservations, setShowReservations] = useState(false);

  if (qrLoading) {
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  if (qrError) {
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center px-8">
        <div className="text-center">
          <p className="text-ink font-semibold text-lg">Invalid QR code</p>
          <p className="text-ink/60 text-sm mt-1">This table code isn't recognised.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-ink text-parchment rounded-full text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (qrTable) {
    return (
      <CustomerShell
        venueId={qrTable.venue_id}
        tableId={qrTable.id}
        tableLabel={qrTable.table_label}
      />
    );
  }

  // No QR table → the landing hub: what Bysen is, and a doorway into
  // every part of the system (customers never see this — their QR goes
  // straight to the shell above).
  if (showReservations) {
    return <ReservationsScreen onBack={() => setShowReservations(false)} />;
  }
  if (inShell) {
    return <CustomerShell venueId={venueId} tableId={null} />;
  }
  return (
    <LandingScreen
      onEnterCustomer={() => setInShell(true)}
      onViewReservations={() => setShowReservations(true)}
      onStaffPortal={() => onSwitchMode("waiter")}
      onKitchenDisplay={() => onSwitchMode("kitchen")}
      onManagerPortal={() => onSwitchMode("manager")}
    />
  );
}

/* ──────────────────── App Shell ──────────────────── */

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();

  const { venue: loadedVenue, loading: venueLoading, error: venueError } = useVenue("velvet-lounge");
  const venueId = loadedVenue.id;

  const qrToken = searchParams.get("table");
  const { table: qrTable, loading: qrLoading, error: qrError } = useQrTable(qrToken);

  const getModeFromPath = (): Mode => {
    const path = location.pathname.replace(/^\/+/, "").split("/")[0];
    if (path === "waiter") return "waiter";
    if (path === "kitchen") return "kitchen";
    if (path === "manager") return "manager";
    return "customer";
  };

  const [mode, setMode] = useState<Mode>(() => getModeFromPath());

  // Back button safety: never let the browser leave the app's first entry
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state === null) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [waiterScreen, setWaiterScreen] = useState<WaiterScreen>("auth");
  const { staffSession, signOut: authSignOut, role, venue, profile } = useAuth();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Manager page is URL-driven: /manager/ops, /manager/floorplan, ...
  const managerPage = useMemo<ManagerPage>(() => {
    const seg = location.pathname.split("/")[2];
    if (
      seg &&
      (seg === "ops" || seg === "floorplan" || seg === "menu" || seg === "staff" ||
        seg === "finance" || seg === "crm" || seg === "brand")
    ) {
      return seg as ManagerPage;
    }
    return "ops";
  }, [location.pathname]);

  const goToManagerPage = useCallback(
    (page: ManagerPage) => navigate(`/manager/${page}`),
    [navigate],
  );

  useEffect(() => {
    if (staffSession) setWaiterScreen("dashboard");
    else setWaiterScreen("auth");
  }, [staffSession]);

  useEffect(() => {
    const paths: Record<Mode, string> = {
      customer: "/",
      waiter: "/waiter",
      kitchen: "/kitchen",
      manager: "/manager",
    };
    const isMatch = (p: string): boolean =>
      mode === "manager" ? p === "/manager" || p.startsWith("/manager/") : p === paths[mode];
    if (!isMatch(location.pathname)) {
      navigate(paths[mode], { replace: true });
    }
  }, [mode, navigate, location.pathname]);

  // /manager defaults to the Live Ops sub-path
  useEffect(() => {
    if (mode === "manager" && (location.pathname === "/manager" || location.pathname === "/manager/")) {
      navigate("/manager/ops", { replace: true });
    }
  }, [mode, location.pathname, navigate]);

  const switchToCustomer = () => {
    setMode("customer");
    setSelectedTable(null);
  };

  const handleStaffSignOut = () => {
    const staffId = staffSession?.id;
    if (staffId) db.clockOutStaff(staffId).catch(() => {});
    authSignOut();
    setSelectedTable(null);
  };

  const handleManagerSignOut = async () => {
    await signOut();
    setMode("customer");
    navigate("/", { replace: true });
  };

  if (!venueLoading && venueError) {
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="text-ink font-semibold text-lg">Venue not found</p>
          <p className="text-ink/60 text-sm mt-2 leading-relaxed">
            The venue <strong>velvet-lounge</strong> doesn't exist in your database yet. Open the Supabase SQL
            Editor and run <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs">supabase/seed-velvet.sql</code>,
            then reload this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      {mode === "customer" && (
        <CustomerFlow
          onSwitchMode={setMode}
          venueId={venueId}
          qrTable={qrTable}
          qrLoading={qrLoading}
          qrError={qrError}
        />
      )}

      {mode === "waiter" && (
        <>
          {waiterScreen === "auth" && !(staffSession || role === "owner") && (
            <StaffAuthScreen />
          )}
          {waiterScreen === "dashboard" && (staffSession || role === "owner") && (
            <TablesDashboard
              venueId={staffSession?.venue_id || venue?.id || ""}
              staffName={staffSession?.name || profile?.name || "Manager"}
              staffId={staffSession?.id || user?.id || ""}
              role={staffSession?.role || "manager"}
              onSelectTable={(table) => {
                setSelectedTable(table);
                setWaiterScreen("order");
              }}
              onSignOut={handleStaffSignOut}
              onViewShift={() => setWaiterScreen("shift")}
            />
          )}
          {waiterScreen === "order" && selectedTable && (
            <OrderManagementScreen
              table={selectedTable}
              staffId={staffSession?.id || user?.id || ""}
              venueId={staffSession?.venue_id || venue?.id || venueId}
              onBack={() => setWaiterScreen("dashboard")}
              onGoToTableOps={() => setWaiterScreen("ops")}
              onGoToInvoice={() => setWaiterScreen("invoice")}
            />
          )}
          {waiterScreen === "ops" && selectedTable && (
            <TableOperationsScreen
              table={selectedTable}
              venueId={staffSession?.venue_id || venue?.id || venueId}
              staffId={staffSession?.id || user?.id || ""}
              onBack={() => setWaiterScreen("order")}
            />
          )}
          {waiterScreen === "invoice" && selectedTable && (
            <InvoiceSettlementScreen
              table={selectedTable}
              staffId={staffSession?.id || user?.id || ""}
              onBack={() => setWaiterScreen("order")}
              onSettled={() => setWaiterScreen("dashboard")}
            />
          )}
          {waiterScreen === "shift" && (
            <ShiftPerformanceScreen
              staffId={staffSession?.id || user?.id || ""}
              staffName={staffSession?.name || profile?.name || "Manager"}
              onBack={() => setWaiterScreen("dashboard")}
            />
          )}
        </>
      )}

      {mode === "kitchen" && (
        (staffSession || role === "owner") ? (
          <KitchenDisplayScreen
            venueId={staffSession?.venue_id || venue?.id || ""}
            staffId={staffSession?.id || user?.id || ""}
            staffName={staffSession?.name || profile?.name || "Manager"}
            onExit={switchToCustomer}
            onSignOut={handleStaffSignOut}
          />
        ) : (
          <StaffAuthScreen />
        )
      )}

      {mode === "manager" && (
        <ProtectedRoute>
          <VenueRequired>
            <ManagerShell
              managerName={user?.email?.split("@")[0] || "Manager"}
              activePage={managerPage}
              onPageChange={goToManagerPage}
              onSignOut={handleManagerSignOut}
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
