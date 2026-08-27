import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams, Routes, Route, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { useRealtime } from "./hooks/useRealtime";
import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider, sectorPath, useAuth } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { ProtectedRoute, VenueRequired } from "./screens/auth/ProtectedRoute";
import { CentralAuthScreen } from "./screens/auth/CentralAuthScreen";
import { VerifyOtpScreen } from "./screens/auth/VerifyOtpScreen";
import { VenueSetupScreen } from "./screens/auth/VenueSetupScreen";
import { LandingScreen } from "./screens/LandingScreen";
import { PromoLandingScreen } from "./screens/PromoLandingScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { type OrderSummary } from "./screens/OrderTrackingScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { CustomerBottomNav } from "./components/CustomerBottomNav";
import { PartyPrompt } from "./components/PartyPrompt";
import { TablePinBanner } from "./components/TablePinBanner";
import { TablePinModal } from "./components/TablePinModal";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ClockIcon } from "@heroicons/react/24/outline";

import { StaffAuthScreen } from "./screens/waiter/StaffAuthScreen";
 
import { TablesDashboard } from "./screens/waiter/TablesDashboard";
import { OrderManagementScreen } from "./screens/waiter/OrderManagementScreen";
import { TableOperationsScreen } from "./screens/waiter/TableOperationsScreen";
import { InvoiceSettlementScreen } from "./screens/waiter/InvoiceSettlementScreen";
import { ShiftPerformanceScreen } from "./screens/waiter/ShiftPerformanceScreen";
import { TableLayout } from "./screens/waiter/TableLayout";

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ReservationsScreen } from "./screens/ReservationsScreen";
import { useVenue } from "./hooks/useVenue";
import { useQrTable } from "./hooks/useQrTable";
import { useCustomerSession } from "./hooks/useCustomerSession";
 
import { db, type DbTable } from "./lib/api";

type NavTab = "menu" | "tab" | "orders";



type Mode = "customer" | "waiter" | "kitchen" | "manager";

/* ──────────────────── Customer Shell (bottom nav) ──────────────────── */

function CustomerShell({ venueId, tableId, tableLabel }: { venueId: string; tableId: string | null; tableLabel?: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const path = location.pathname;
  let tab: NavTab = "menu";
  if (path.startsWith("/tab")) tab = "tab";
  if (path.startsWith("/orders")) tab = "orders";

  const setTab = useCallback((newTab: NavTab) => {
    const tableParam = searchParams.get("table");
    const query = tableParam ? `?table=${tableParam}` : "";
    navigate(`/${newTab}${query}`);
  }, [navigate, searchParams]);

  const [activeOrders, setActiveOrders] = useState<OrderSummary[]>([]);
  const [history, setHistory] = useState<OrderSummary[]>([]);
  const [payingOrder, setPayingOrder] = useState<OrderSummary | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const { itemCount } = useCart();

  const { session, bill, waiter, loading: sessionLoading, error: sessionError, updateParty } = useCustomerSession(venueId, tableId);

  // Table PIN Security State
  // eslint-disable-next-line no-empty
  const [pinInputVerified, setPinInputVerified] = useState<boolean>(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  const pinUnlocked = useMemo(() => {
    if (!bill?.table_pin) return true;
    if (pinInputVerified) return true;
    try {
      return localStorage.getItem(`nightos:table_pin:${bill.id}`) === bill.table_pin;
    } catch {
      return false;
    }
  }, [bill, pinInputVerified]);

  // eslint-disable-next-line no-empty
  // One-time "how many of you?" prompt per session (QR tables only)
  const [partyPromptOpen, setPartyPromptOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!tableId || !session || partyPromptOpen) return;
      try {
        if (localStorage.getItem(`nightos:party:${session.id}`) === "1") return;
        // If an open bill already exists on the table or session already configured, do NOT prompt again
        if (bill || (session.party_size && session.party_size > 1)) return;
      } catch {
        // ignore
      }
      if (!cancelled) setPartyPromptOpen(true);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [tableId, session, bill, partyPromptOpen]);

  const handlePartyConfirm = useCallback(
    async (partySize: number, guestName?: string) => {
      const { error } = await updateParty(partySize, guestName);
      if (error) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        toast.error(String(error));
        return;
      }
      // eslint-disable-next-line no-empty
      try { localStorage.setItem(`nightos:party:${session?.id ?? ''}`, "1"); } catch { /* ignore */ }
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        },
        () => {},
      );
    // eslint-disable-next-line no-empty
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  // ── Load live orders for this table's open bill from the database ──
  // eslint-disable-next-line no-empty
  const [ordersRevision, setOrdersRevision] = useState(0);
  const triggerReload = useCallback(() => setOrdersRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    const billId = bill?.id;
    const sessionToken = session?.session_token;
    if (!billId) return;

    const fetchOrders = async () => {
      try {
        const { data: subs } = await db.submissionsByBill(billId, sessionToken);
        if (cancelled) return;
        if (!subs || subs.length === 0) {
          setActiveOrders([]);
          setHistory([]);
          return;
        }

        const summaries: OrderSummary[] = await Promise.all(
          subs.map(async (s) => {
            const { data: items } = await db.orderItemsBySubmission(s.id);
            const itemList = items ?? [];
            const total = itemList.reduce((sum, i) => sum + Number(i.line_total || 0), 0);
            const count = itemList.reduce((sum, i) => sum + i.quantity, 0);
            return {
              orderNumber: s.id.slice(0, 8).toUpperCase(),
              billId: s.bill_id,
              submissionId: s.id,
              sentAt: new Date(s.created_at).getTime(),
              status: (s.status === 'pending' ? 'confirmed' : s.status) as OrderSummary['status'],
              cancelled: s.status === 'cancelled',
              itemCount: count,
              total,
              items: itemList.map((i) => ({
                name: i.product_name,
                qty: i.quantity,
                image: '',
                lineTotal: Number(i.line_total || 0),
              })),
            };
          }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        );

        if (cancelled) return;
        const active = summaries.filter((o) => o.status && ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
        const past = summaries.filter((o) => o.status && ['served', 'cancelled'].includes(o.status));

        setActiveOrders(active);
        setHistory(past);
      } catch {
        // ignore
      }
    };

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [bill, session, ordersRevision]);

  // Live refresh: kitchen order updates stream in realtime
  useRealtime({
    table: 'order_submissions',
    filter: bill?.id ? `bill_id=eq.${bill.id}` : undefined,
    onInsert: triggerReload,
    onUpdate: triggerReload,
    onDelete: triggerReload,
  });

  const handleOrderSent = useCallback((order: OrderSummary) => {
    setActiveOrders((prev) => [...prev, order]);
    setTab("orders");
  }, [setTab]);

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
      <div className="min-h-svh bg-isabelline font-sans text-licorice flex items-center justify-center px-8">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-licorice/5">
            <ClockIcon className="h-8 w-8 text-licorice/70" />
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-licorice">Your visit timed out</h1>
          <p className="text-[13px] text-licorice/70 mt-2 leading-relaxed">
            {venueName ?? "Velvet Lounge"} ({tableLabel ?? "this table"}) ended this visit because no
            order was placed within 20 minutes. Scan the QR code on the table again to start over.
          </p>
          <button
            onClick={() => {
              try { sessionStorage.removeItem('nightos:current_session_id') } catch {}
              window.location.reload()
            }}
            className="mt-8 px-8 py-3.5 bg-licorice text-[14px] text-isabelline font-bold rounded-full transition-transform active:scale-95"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (tableId && (sessionLoading || sessionError || !session || !bill)) {
    if (sessionError) {
      return (
        <div className="min-h-svh bg-isabelline font-sans text-licorice flex items-center justify-center px-8">
          <div className="text-center">
            <h1 className="text-[22px] font-black tracking-tight text-licorice">Couldn't start your visit</h1>
            <p className="text-[13px] text-licorice/70 mt-2">Please check your connection and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-8 px-8 py-3.5 bg-licorice text-[14px] text-isabelline font-bold rounded-full transition-transform active:scale-95"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-licorice/20 border-t-licorice rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-isabelline pb-20">
      {tab === "menu" && (
        <MenuScreen
          venueId={venueId}
          venueName={venueName}
          tableLabel={tableLabel}
          waiterName={waiter?.name ?? null}
          tablePin={pinUnlocked && bill?.table_pin ? bill.table_pin : null}
          onViewCart={() => setTab("tab")}
        />
      )}
      {tab === "tab" && (
        <CartScreen
          venueId={venueId}
          venueName={venueName ?? undefined}
          tableLabel={tableLabel ?? undefined}
          tablePin={pinUnlocked && bill?.table_pin ? bill.table_pin : null}
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
          tablePin={pinUnlocked && bill?.table_pin ? bill.table_pin : null}
          venueName={venueName}
          billId={bill?.id ?? null}
          sessionToken={session?.session_token}
          onPayBill={setPayingOrder}
          onBack={() => setTab("tab")}
        />
      )}
      <CustomerBottomNav activeTab={tab} onTabChange={setTab} cartCount={itemCount} />

      {/* PIN Protection Modal for anyone joining an active table */}
      {!pinUnlocked && bill?.table_pin && (
        <TablePinModal
          tableLabel={tableLabel}
          expectedPin={bill.table_pin}
          onSuccess={() => {
            try { localStorage.setItem(`nightos:table_pin:${bill.id}`, bill.table_pin ?? ""); } catch { /* noop */ }
            setPinInputVerified(true);
          }}
        />
      )}

      {partyPromptOpen && pinUnlocked && (
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
  const location = useLocation();
  const navigate = useNavigate();

  if (qrLoading) {
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-licorice/20 border-t-licorice rounded-full animate-spin" />
      </div>
    );
  }

  if (qrError) {
    return (
      <div className="min-h-svh bg-isabelline font-sans text-licorice flex items-center justify-center px-8">
        <div className="text-center">
          <h1 className="text-[22px] font-black tracking-tight text-licorice">Invalid QR code</h1>
          <p className="text-[13px] text-licorice/70 mt-2">This table code isn't recognised.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-8 py-3.5 bg-licorice text-[14px] text-isabelline font-bold rounded-full transition-transform active:scale-95"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (qrTable) {
    if (location.pathname === "/") {
      return <Navigate to={`/menu${location.search}`} replace />;
    }
    return (
      <CustomerShell
        venueId={qrTable.venue_id}
        tableId={qrTable.id}
        tableLabel={qrTable.table_label}
      />
    );
  }

  if (location.pathname === "/reservations") {
    return <ReservationsScreen onBack={() => navigate("/")} />;
  }

  if (location.pathname.startsWith("/menu") || location.pathname.startsWith("/tab") || location.pathname.startsWith("/orders")) {
    return <CustomerShell venueId={venueId} tableId={null} />;
  }

  return (
    <LandingScreen
      onEnterCustomer={() => navigate("/menu")}
      onViewReservations={() => navigate("/reservations")}
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
  const { user, signOut, staffSession, role, venue: authVenue, profile } = useAuth();

  const targetSlug = authVenue?.slug || "velvet-lounge";
  const { venue: loadedVenue, loading: venueLoading, error: venueError } = useVenue(targetSlug);
  const currentVenue = authVenue || loadedVenue;
  const venueId = currentVenue.id;

  const qrToken = searchParams.get("table");
  const { table: qrTable, loading: qrLoading, error: qrError } = useQrTable(qrToken);

  const getModeFromPath = (): Mode => {
    const path = location.pathname.replace(/^\/+/, "").split("/")[0];
    if (path === "waiter") return "waiter";
    if (path === "kitchen") return "kitchen";
    if (path === "manager") return "manager";
    return "customer";
  };

  const mode = getModeFromPath();
  const setMode = useCallback((newMode: Mode) => {
    const paths: Record<Mode, string> = {
      customer: "/switcher",
      waiter: "/waiter",
      kitchen: "/kitchen",
      manager: "/manager/ops",
    };
    navigate(paths[newMode]);
  }, [navigate]);

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

  // /manager defaults to the Live Ops sub-path
  useEffect(() => {
    if (mode === "manager" && (location.pathname === "/manager" || location.pathname === "/manager/")) {
      navigate("/manager/ops", { replace: true });
    }
  }, [mode, location.pathname, navigate]);

  const switchToCustomer = () => {
    setMode("customer");
  };

  const handleStaffSignOut = () => {
    const staffId = staffSession?.id;
    if (staffId) db.clockOutStaff(staffId).catch(() => {});
    signOut();
  };

  const handleManagerSignOut = async () => {
    await signOut();
    setMode("customer");
    navigate("/", { replace: true });
  };

  if (!authVenue && !venueLoading && venueError) {
    return (
      <div className="min-h-svh bg-isabelline flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="text-ink font-semibold text-lg">Venue not found</p>
          <p className="text-ink/60 text-sm mt-2 leading-relaxed">
            The venue <strong>velvet-lounge</strong> doesn't exist in your database yet. Open the Supabase SQL
            Editor and run <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs">supabase/02-clean-seed.sql</code>,
            then reload this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      {mode === "customer" && (
        <Routes>
          <Route path="/*" element={
            <CustomerFlow
              onSwitchMode={setMode}
              venueId={venueId}
              qrTable={qrTable}
              qrLoading={qrLoading}
              qrError={qrError}
            />
          } />
        </Routes>
      )}

      {mode === "waiter" && (
        <Routes>
          <Route path="/waiter" element={
            (staffSession || role === "owner") ? (
              <TablesDashboard
                venueId={staffSession?.venue_id || authVenue?.id || venueId || ""}
                staffName={staffSession?.name || profile?.name || "Manager"}
                staffId={staffSession?.id || user?.id || ""}
                role={staffSession?.role || "manager"}
                onSignOut={handleStaffSignOut}
              />
            ) : (
              <Navigate to="/waiter/login" replace />
            )
          } />
          <Route path="/waiter/login" element={
            !(staffSession || role === "owner") ? <StaffAuthScreen /> : <Navigate to="/waiter" replace />
          } />
          <Route path="/waiter/shift" element={
            <ShiftPerformanceScreen
              staffId={staffSession?.id || user?.id || ""}
              staffName={staffSession?.name || profile?.name || "Manager"}
            />
          } />
          <Route path="/waiter/table/:tableId" element={<TableLayout />}>
            <Route index element={<OrderManagementScreen />} />
            <Route path="ops" element={<TableOperationsScreen />} />
            <Route path="invoice" element={<InvoiceSettlementScreen />} />
          </Route>
        </Routes>
      )}

      {mode === "kitchen" && (
        (staffSession || role === "owner") ? (
          <KitchenDisplayScreen
            venueId={staffSession?.venue_id || authVenue?.id || venueId || ""}
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
              {managerPage === "ops" && <LiveOpsScreen onNavigate={goToManagerPage} />}
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
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isInitializing, role } = useAuth();

  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";
  const isVerifyRoute = location.pathname === "/verify-otp";
  const isSetupRoute = location.pathname === "/setup";
  const isTableScan = Boolean(searchParams.get("table"));
  const isPromoRoute = location.pathname === "/" && !isTableScan;
  const isSwitcherRoute = location.pathname === "/switcher";

  if (isPromoRoute) return <PromoLandingScreen />;
  if (isSwitcherRoute) return <AppShell />;

  if (isAuthRoute) {
    if (isAuthenticated && !isInitializing) {
      return <Navigate to={role ? sectorPath(role) : "/setup"} replace />;
    }
    return <CentralAuthScreen initialMode={location.pathname === "/signup" ? "signup" : "login"} />;
  }
  if (isVerifyRoute) return <VerifyOtpScreen />;
  if (isSetupRoute) return <VenueSetupScreen />;

  return <AppShell />;
}

export default App;
