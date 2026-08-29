import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../lib/api";
import { useRealtime } from "../../hooks/useRealtime";
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  EyeIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';

type FlatOrder = {
  id: string;
  status: OrderStatus;
  guestName: string;
  createdAt: string;
  notes: string | null;
  tableLabel: string;
  itemCount: number;
  totalAmount: number;
  items: { product_name: string; quantity: number; line_total: number; notes: string | null }[];
};

export function ManagerOrdersScreen({ venueId }: { venueId: string }) {
  const [orders, setOrders] = useState<FlatOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [timeFilter, setTimeFilter] = useState<1 | 7 | 30>(1); // days

  // Modal
  const [selectedOrder, setSelectedOrder] = useState<FlatOrder | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.managerAllOrders(venueId, timeFilter);
    if (!error && data) {
      const flattened: FlatOrder[] = data.map((d: any) => {
        const table = Array.isArray(d.bills) ? d.bills[0]?.tables : d.bills?.tables;
        const tableActual = Array.isArray(table) ? table[0] : table;
        const items = d.order_items || [];
        
        return {
          id: d.id,
          status: d.status,
          guestName: d.guest_name || "Walk-in",
          createdAt: d.created_at,
          notes: d.notes,
          tableLabel: tableActual?.table_label || `Table ${tableActual?.table_number || "—"}`,
          itemCount: items.reduce((acc: number, item: any) => acc + item.quantity, 0),
          totalAmount: items.reduce((acc: number, item: any) => acc + item.line_total, 0),
          items: items.map((i: any) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            line_total: i.line_total,
            notes: i.notes
          }))
        };
      });
      setOrders(flattened);
    }
    setLoading(false);
  }, [venueId, timeFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useRealtime({
    table: 'order_submissions',
    filter: `venue_id=eq.${venueId}`,
    onInsert: loadOrders,
    onUpdate: loadOrders,
  });

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !o.id.toLowerCase().includes(q) &&
          !o.guestName.toLowerCase().includes(q) &&
          !o.tableLabel.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return "bg-orange-100 text-orange-800";
      case 'confirmed': return "bg-blue-100 text-blue-800";
      case 'preparing': return "bg-purple-100 text-purple-800";
      case 'ready': return "bg-green-100 text-green-800";
      case 'served': return "bg-gray-100 text-gray-600";
      case 'cancelled': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100svh-120px)] max-w-7xl mx-auto space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm ring-1 ring-licorice/5 shrink-0">
        <div className="flex-1 w-full relative">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-feldgrau" />
          <input 
            type="text" 
            placeholder="Search by Order ID, Guest, or Table..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-isabelline/50 text-[14px] rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-licorice/20 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex items-center bg-isabelline/50 rounded-xl p-1 shrink-0">
            {[
              { label: '24h', val: 1 },
              { label: '7d', val: 7 },
              { label: '30d', val: 30 }
            ].map(tf => (
              <button
                key={tf.val}
                onClick={() => setTimeFilter(tf.val as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeFilter === tf.val ? 'bg-white text-licorice shadow-sm ring-1 ring-licorice/5' : 'text-feldgrau hover:text-licorice'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {['all', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s as any)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-[13px] font-bold capitalize transition-all border ${
                  statusFilter === s 
                  ? 'bg-khaki text-licorice border-khaki shadow-sm' 
                  : 'bg-white text-feldgrau border-licorice/10 hover:border-licorice/30'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-licorice/5 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="overflow-x-auto flex-1 h-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr className="border-b border-licorice/5 bg-isabelline/30">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau">Order Ref</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau">Time</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau">Table & Guest</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau">Items</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau">Total</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-feldgrau text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-licorice/5 overflow-y-auto">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-feldgrau text-sm font-semibold">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-feldgrau text-sm font-semibold">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-isabelline/20 transition-colors group cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-[13px] font-bold text-licorice">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-feldgrau">
                        <ClockIcon className="h-4 w-4" />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-licorice/30 px-1">•</span>
                        {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-licorice">{order.tableLabel}</span>
                        <span className="text-xs font-semibold text-feldgrau">{order.guestName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[13px] font-bold text-licorice">{order.itemCount} items</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[14px] font-bold text-licorice">
                        GH₵{order.totalAmount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-feldgrau hover:text-licorice hover:bg-white ring-1 ring-transparent hover:ring-licorice/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-licorice/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedOrder(null)} 
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2rem] bg-isabelline shadow-2xl ring-1 ring-licorice/5 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex-none px-6 py-5 border-b border-licorice/5 flex items-start justify-between bg-white">
              <div>
                <h3 className="text-lg font-black tracking-tight text-licorice">
                  Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-feldgrau">
                  <span>{selectedOrder.tableLabel}</span>
                  <span className="text-licorice/20">•</span>
                  <span>{selectedOrder.guestName}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
                <button
                  type="button"
                  className="rounded-full bg-isabelline p-2 text-feldgrau hover:bg-licorice/5 hover:text-licorice transition-colors"
                  onClick={() => setSelectedOrder(null)}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable items list) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedOrder.notes && (
                <div className="bg-khaki/10 text-khaki-900 p-4 rounded-xl text-[13px] font-medium border border-khaki/20">
                  <strong>Note:</strong> {selectedOrder.notes}
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-feldgrau mb-2">Order Items</h4>
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4 p-4 rounded-xl bg-white shadow-sm ring-1 ring-licorice/5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-isabelline text-[13px] font-bold text-licorice">
                        {item.quantity}x
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-licorice">{item.product_name}</span>
                        {item.notes && (
                          <span className="text-[12px] font-medium text-feldgrau italic mt-0.5">
                            "{item.notes}"
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[14px] font-bold text-licorice">
                      GH₵{item.line_total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex-none p-6 border-t border-licorice/5 bg-white">
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-bold text-feldgrau">Total Amount</span>
                <span className="text-[20px] font-black text-licorice tracking-tight">
                  GH₵{selectedOrder.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
