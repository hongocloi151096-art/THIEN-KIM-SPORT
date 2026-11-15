import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, ClipboardList, Clock, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OrderItem, Supplier } from '@/lib/types';
import { formatVND, formatDate } from '@/lib/pricing';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  EmptyState,
} from '@/components/ui';

interface SupplierGroup {
  supplier: Supplier | null;
  items: { item: OrderItem; order_code: string }[];
  total: number;
}

export default function DailyConsolidation() {
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);

    // Get today's orders that are not yet consolidated (pending/preparing shipping)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .in('shipping_status', ['pending', 'preparing'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error:', error);
      setLoading(false);
      return;
    }

    // Get suppliers
    const { data: suppliers } = await supabase.from('suppliers').select('*');

    // Group order items by supplier (using order's supplier_id as fallback)
    const supplierMap = new Map<string, Supplier>();
    (suppliers || []).forEach((s) => supplierMap.set(s.id, s));

    const groupMap = new Map<string, SupplierGroup>();

    (orders || []).forEach((order) => {
      (order.order_items || []).forEach((item: OrderItem) => {
        // Find the product's default supplier
        const key = order.supplier_id || 'no-supplier';
        if (!groupMap.has(key)) {
          const supplier = supplierMap.get(order.supplier_id || '') || null;
          groupMap.set(key, { supplier, items: [], total: 0 });
        }
        const group = groupMap.get(key)!;
        group.items.push({ item, order_code: order.order_code });
        group.total += item.subtotal;
      });
    });

    setGroups(Array.from(groupMap.values()));
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = async (group: SupplierGroup, index: number) => {
    const supplierName = group.supplier?.name || 'Chưa phân xưởng';
    let text = `=== ĐẶT HÀNG THIÊN KIM ===\n`;
    text += `Nhà cung ứng: ${supplierName}\n`;
    text += `Ngày: ${formatDate(selectedDate)}\n`;
    text += `---------------------------\n`;

    // Aggregate by product
    const productMap = new Map<string, { name: string; variant: string; sku: string; qty: number }>();
    group.items.forEach(({ item }) => {
      const key = item.product_sku || item.product_name || '';
      const existing = productMap.get(key);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        productMap.set(key, {
          name: item.product_name || '',
          variant: item.product_variant || '',
          sku: item.product_sku || '',
          qty: item.quantity,
        });
      }
    });

    let idx = 1;
    productMap.forEach((p) => {
      text += `${idx}. ${p.name} ${p.variant} (${p.sku})\n   SL: ${p.qty} cái\n`;
      idx++;
    });

    text += `---------------------------\n`;
    text += `Tổng SL: ${group.items.reduce((s, i) => s + i.item.quantity, 0)} cái\n`;
    text += `Tổng tiền ước tính: ${formatVND(group.total)}\n`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(String(index));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('Không thể copy. Vui lòng copy thủ công.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    );
  }

  const totalItems = groups.reduce((s, g) => s + g.items.reduce((is, i) => is + i.item.quantity, 0), 0);
  const totalAmount = groups.reduce((s, g) => s + g.total, 0);

  return (
    <div>
      <PageHeader
        title="Chốt đơn 12h trưa & Nhà cung ứng"
        subtitle="Gom nhóm sản phẩm theo xưởng để đặt hàng"
      />

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <Clock size={12} /> Ngày chốt đơn
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-4 sm:ml-auto">
            <div className="text-center">
              <p className="text-xs text-slate-500">Tổng SL</p>
              <p className="text-lg font-bold text-blue-700">{totalItems}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Tổng tiền</p>
              <p className="text-lg font-bold text-red-600">{formatVND(totalAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Xưởng</p>
              <p className="text-lg font-bold text-slate-700">{groups.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            message="Không có đơn hàng nào cần chốt trong ngày này"
            icon={<ClipboardList size={40} />}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group, idx) => {
            const supplierName = group.supplier?.name || 'Chưa phân xưởng';
            const productMap = new Map<string, { name: string; variant: string; sku: string; qty: number }>();
            group.items.forEach(({ item }) => {
              const key = item.product_sku || item.product_name || '';
              const existing = productMap.get(key);
              if (existing) {
                existing.qty += item.quantity;
              } else {
                productMap.set(key, {
                  name: item.product_name || '',
                  variant: item.product_variant || '',
                  sku: item.product_sku || '',
                  qty: item.quantity,
                });
              }
            });

            return (
              <Card key={idx} className="overflow-hidden">
                <div className="bg-blue-900 text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Package size={18} />
                      {supplierName}
                    </h3>
                    {group.supplier?.contact_zalo && (
                      <p className="text-xs text-blue-300 mt-0.5">Zalo: {group.supplier.contact_zalo}</p>
                    )}
                  </div>
                  <Button
                    variant={copiedId === String(idx) ? 'success' : 'secondary'}
                    size="sm"
                    onClick={() => handleCopy(group, idx)}
                    className="!bg-white !text-blue-700 hover:!bg-blue-50"
                  >
                    {copiedId === String(idx) ? (
                      <><Check size={14} className="inline mr-1" /> Đã copy!</>
                    ) : (
                      <><Copy size={14} className="inline mr-1" /> Copy đặt hàng</>
                    )}
                  </Button>
                </div>

                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 font-medium text-slate-600 w-8">#</th>
                        <th className="text-left py-2 font-medium text-slate-600">Sản phẩm</th>
                        <th className="text-center py-2 font-medium text-slate-600">SL</th>
                        <th className="text-right py-2 font-medium text-slate-600">T.Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(productMap.entries()).map(([key, p], i) => {
                        const itemTotal = group.items
                          .filter((gi) => (gi.item.product_sku || gi.item.product_name) === key)
                          .reduce((s, gi) => s + gi.item.subtotal, 0);
                        return (
                          <tr key={key} className="border-b border-slate-100">
                            <td className="py-2 text-slate-400 text-xs">{i + 1}</td>
                            <td className="py-2">
                              <p className="text-sm text-slate-700">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.variant} | {p.sku}</p>
                            </td>
                            <td className="py-2 text-center">
                              <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                {p.qty}
                              </span>
                            </td>
                            <td className="py-2 text-right font-medium text-slate-700">{formatVND(itemTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="text-right py-3 font-semibold text-slate-700">Tổng:</td>
                        <td className="text-center py-3 font-bold text-blue-700">
                          {group.items.reduce((s, i) => s + i.item.quantity, 0)}
                        </td>
                        <td className="text-right py-3 font-bold text-red-600">{formatVND(group.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
