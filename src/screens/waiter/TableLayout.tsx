import { useEffect, useState } from "react";
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { db } from "../../lib/api";
import type { Table } from "./TablesDashboard";
import { useAuth } from "../../context/AuthContext";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export function TableLayout() {
    const { tableId } = useParams<{ tableId: string }>();
    const navigate = useNavigate();
    const [table, setTable] = useState<Table | null>(null);
    const [tableVenueId, setTableVenueId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const { staffSession, user, venue } = useAuth();

    const venueId = tableVenueId || staffSession?.venue_id || venue?.id || "a0000000-0000-0000-0000-000000000001";
    const staffId = staffSession?.id || user?.id || "";

    useEffect(() => {
        let cancelled = false;
        async function fetchTable() {
            if (!tableId) {
                setLoading(false);
                return;
            }
            try {
                const { data, error } = await db.tableById(tableId);
                if (cancelled) return;
                
                if (error || !data) {
                    setTable(null);
                } else {
                    setTableVenueId(data.venue_id);
                    // Map DbTable to the Table format expected by child screens
                    setTable({
                        id: data.id,
                        number: data.table_number,
                        label: data.table_label,
                        status: 'occupied', // Actual status is handled by children/dashboard
                    });
                }
            } catch {
                if (!cancelled) setTable(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchTable();
        return () => { cancelled = true; };
    }, [tableId]);

    if (loading) {
        return (
            <div className="min-h-svh bg-isabelline flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-licorice/20 border-t-licorice rounded-full animate-spin" />
            </div>
        );
    }

    if (!table) {
        return (
            <main className="relative min-h-svh w-full overflow-x-hidden bg-isabelline font-sans text-licorice flex flex-col items-center justify-center px-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-isabelline ring-1 ring-licorice/8">
                    <ExclamationTriangleIcon className="h-6 w-6 text-feldgrau" strokeWidth={1.75} />
                </div>
                <h1 className="mt-4 text-[18px] font-bold tracking-tight text-licorice">
                    Table Not Found
                </h1>
                <p className="mt-1.5 max-w-[260px] text-[12px] leading-[1.5] text-feldgrau">
                    We couldn't find the table you're looking for. It may have been removed.
                </p>
                <button
                    type="button"
                    onClick={() => navigate('/waiter')}
                    className="mt-6 rounded-full bg-licorice px-6 py-3 text-[12px] font-bold tracking-tight text-isabelline transition-all hover:bg-licorice/95 active:scale-[0.985]"
                >
                    Back to Floorplan
                </button>
            </main>
        );
    }

    // Pass the fetched table, venueId, and staffId down to the active child route
    return <Outlet context={{ table, venueId, staffId }} />;
}
