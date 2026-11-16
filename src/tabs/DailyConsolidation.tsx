import { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  ClipboardList,
  Clock,
  Package,
  Send,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OrderItem, Supplier } from '@/lib/types';
import { formatVND, formatDate } from '@/lib/pricing';
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
} from '@/components/ui';

interface SupplierGroup {
  supplier: Supplier | null;
  items: { item: OrderItem; order_code: string }[];
  total: number;
}

interface ProductAgg {
  name: string;
  variant: string;
  sku: string;
  qty: number;
}

function aggregateProducts(items: { item: OrderItem; order_code: string }[]): Map<string, ProductAgg> {
  const map = new Map<string, ProductAgg>();
  items.forEach(({ item }) => {
    const key = item.product_sku || item.product_name || '';
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.quantity;
    } else {
      map.set(key, {
        name: item.product_name || '',
        variant: item.product_variant || '',
        sku: item.product_sku || '',
        qty: item.quantity,
      });
    }
  });
  return map;
}

function buildSupplierOrderText(supplierName: string, dateStr: string, group: SupplierGroup): string {
  const productMap = aggregateProducts(group.items);
  let text = `=== ĐẶT HÀNG THIÊN KIM ===\n`;
  text += `Nhà cung ứng: ${supplierName}\n`;
  text += `Ngày chốt: ${formatDate(dateStr)}\n`;
  text += `---------------------------\n`;
  let idx = 1;
  productMap.forEach((p) => {
    text += `${idx}. ${p.name} ${p.variant} (${p.sku})\n   SL: ${p.qty} cái\n`;
    idx++;
  });
  text += `---------------------------\n`;
  text += `Tổng SL: ${group.items.reduce((s, i) => s + i.item.quantity, 0)} cái\n`;
  text += `Tổng tiền ước tính: ${formatVND(group.total)}\n`;
  return text;
}

export default function DailyConsolidation() {
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendMsg, setSendMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);

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

    const { data: suppliers } = await supabase.from('suppliers').select('*');
    const supplierMap = new Map<string, Supplier>();
    (suppliers || []).forEach((s) => supplierMap.set(s.id, s));

    const groupMap = new Map<string, SupplierGroup>();

    (orders || []).forEach((order) => {
      (order.order_items || []).forEach((item: OrderItem) => {
        const sid = item.supplier_id || order.supplier_id || null;
        const key = sid || 'no-supplier';
        if (!groupMap.has(key)) {
          const supplier = sid ? supplierMap.get(sid) || null : null;
          groupMap.set(key, { supplier, items: [], total: 0 });
        }
        const group = groupMap.get(key)!;
        group.items.push({ item, order_code: order.order_code });
        group.total += item.subtotal;
      });
    });

    setGroups(Array.from(groupMap.values()));
    setSentIds(new Set());
    setSendMsg(null);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = async (group: SupplierGroup, index: number) => {
    const supplierName = group.supplier?.name || 'Chưa phân xưởng';
    const text = buildSupplierOrderText(supplierName, selectedDate, group);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(String(index));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('Không thể copy. Vui lòng copy thủ công.');
    }
  };

  const handleSendToFactory = async (group: SupplierGroup, index: number) => {
    const supplier = group.supplier;
    const groupKey = String(index);
    if (!supplier) {
      setSendMsg({ id: groupKey, ok: false, text: 'Nhóm này chưa có nhà cung ứng, không thể gửi tự động.' });
      setTimeout(() => setSendMsg(null), 4000);
      return;
    }
    const channel = supplier.default_channel || 'zalo_group';
    const content = buildSupplierOrderText(supplier.name, selectedDate, group);

    setSendingId(groupKey);
    const inserts: { channel: string; recipient: string | null; recipient_type: string; content: string; status: string; related_supplier_id: string }[] = [];

    if (channel === 'zalo_group' || channel === 'both') {
      if (supplier.zalo_group_id) {
        inserts.push({
          channel: 'zalo_group',
          recipient: supplier.zalo_group_id,
          recipient_type: 'zalo_group_id',
          content,
          status: 'pending',
          related_supplier_id: supplier.id,
        });
      }
    }
    if (channel === 'messenger_group' || channel === 'both') {
      if (supplier.messenger_group_id) {
        inserts.push({
          channel: 'messenger_group',
          recipient: supplier.messenger_group_id,
          recipient_type: 'messenger_group_id',
          content,
          status: 'pending',
          related_supplier_id: supplier.id,
        });
      }
    }

    if (inserts.length === 0) {
      const missing = channel === 'messenger_group' ? 'Messenger' : channel === 'both' ? 'Zalo/Messenger' : 'Zalo';
      setSendMsg({
        id: groupKey,
        ok: false,
        text: `Chưa cấu hình ID nhóm ${missing} cho nhà cung ứng "${supplier.name}". Vui lòng nhập trong Cài đặt.`,
      });
      setTimeout(() => setSendMsg(null), 5000);
      setSendingId(null);
      return;
    }

    const { error } = await supabase.from('message_outbox').insert(inserts);
    setSendingId(null);
    if (error) {
      setSendMsg({ id: groupKey, ok: false, text: `Lỗi gửi: ${error.message}` });
    } else {
      setSentIds((prev) => new Set(prev).add(groupKey));
      setSendMsg({
        id: groupKey,
        ok: true,
        text: `Đã đẩy ${inserts.length} tin nhắn đặt hàng vào hàng đợi (${inserts.map((i) => i.channel).join(', ')}).`,
      });
    }
    setTimeout(() => setSendMsg(null), 5000);
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
        subtitle="Gom nhóm sản phẩm theo xưởng (từng món trong đơn) để đặt hàng"
      />

      {sendMsg && (
        <div className={`mb-4 rounded-xl p-3 flex items-start gap-2 text-sm ${
          sendMsg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {sendMsg.ok ? <Check size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
          <span>{sendMsg.text}</span>
        </div>
      )}

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
            const productMap = aggregateProducts(group.items);
            const groupKey = String(idx);
            const sent = sentIds.has(groupKey);
            const channelLabel = group.supplier?.default_channel === 'messenger_group'
              ? 'Messenger'
              : group.supplier?.default_channel === 'both'
              ? 'Zalo + Messenger'
              : 'Zalo Group';

            return (
              <Card key={groupKey} className="overflow-hidden">
                <div
                  className="text-white px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ backgroundColor: '#1E3A8A' }}
                >
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Package size={18} />
                      {supplierName}
                    </h3>
                    {group.supplier?.contact_zalo && (
                      <p className="text-xs text-blue-200 mt-0.5">
                        Zalo: {group.supplier.contact_zalo}
                        {group.supplier.zalo_group_id && <> · Nhóm Zalo: {group.supplier.zalo_group_id}</>}
                        {group.supplier.messenger_group_id && <> · Nhóm Msg: {group.supplier.messenger_group_id}</>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={copiedId === groupKey ? 'success' : 'secondary'}
                      size="sm"
                      onClick={() => handleCopy(group, idx)}
                      className="!bg-white !text-blue-700 hover:!bg-blue-50"
                    >
                      {copiedId === groupKey ? (
                        <><Check size={14} className="inline mr-1" /> Đã copy!</>
                      ) : (
                        <><Copy size={14} className="inline mr-1" /> Copy đặt hàng</>
                      )}
                    </Button>
                    {group.supplier && (
                      <Button
                        variant={sent ? 'success' : 'danger'}
                        size="sm"
                        onClick={() => handleSendToFactory(group, idx)}
                        disabled={sendingId === groupKey || sent}
                        className="!bg-red-600 hover:!bg-red-700 !text-white"
                      >
                        {sent ? (
                          <><Check size={14} className="inline mr-1" /> Đã gửi ({channelLabel})</>
                        ) : sendingId === groupKey ? (
                          <><Send size={14} className="inline mr-1 animate-pulse" /> Đang gửi...</>
                        ) : (
                          <><Send size={14} className="inline mr-1" /> Gửi Xưởng Tự Động</>
                        )}
                      </Button>
                    )}
                  </div>
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
