import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Truck,
  Printer,
  Eye,
  Calendar,
  Filter,
  Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Order, OrderItem, Supplier } from '@/lib/types';
import { formatVND, formatDate, formatDateTime } from '@/lib/pricing';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Select,
  EmptyState,
  PAYMENT_STATUS_LABELS,
  SHIPPING_STATUS_LABELS,
  PAYMENT_STATUS_VARIANT,
  SHIPPING_STATUS_VARIANT,
} from '@/components/ui';

interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export default function OrdersList() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [shippingFilter, setShippingFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (dateFilter) {
      const start = new Date(dateFilter);
      const end = new Date(dateFilter);
      end.setDate(end.getDate() + 1);
      query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
    }
    if (paymentFilter) query = query.eq('payment_status', paymentFilter);
    if (shippingFilter) query = query.eq('shipping_status', shippingFilter);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      let filtered = data || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (o) =>
            o.order_code?.toLowerCase().includes(q) ||
            o.customer_name?.toLowerCase().includes(q) ||
            o.customer_phone?.includes(q)
        );
      }
      setOrders(filtered as OrderWithItems[]);
    }
    setLoading(false);
  }, [dateFilter, paymentFilter, shippingFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    supabase.from('suppliers').select('*').order('name').then(({ data }) => {
      if (data) setSuppliers(data);
    });
  }, []);

  const updateOrderField = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from('orders').update({ [field]: value }).eq('id', id);
    if (error) {
      console.error('Update error:', error);
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, [field]: value });
    }
  };

  const pushToViettelPost = async (order: OrderWithItems) => {
    alert(
      `Đẩy đơn ${order.order_code} đến Viettel Post.\n` +
      `Người nhận: ${order.customer_name}\n` +
      `SĐT: ${order.customer_phone}\n` +
      `Địa chỉ: ${order.customer_address || 'N/A'}\n` +
      `Cod: ${formatVND(order.total_amount)}`
    );
    await updateOrderField(order.id, 'shipping_status', 'shipped');
    await updateOrderField(order.id, 'shipping_carrier', 'Viettel Post');
  };

  const printShippingLabel = (order: OrderWithItems) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <title>Vận đơn ${order.order_code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; width: 80mm; padding: 4mm; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .header h2 { font-size: 16px; }
          .header p { font-size: 11px; }
          .section { margin-bottom: 8px; }
          .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px dashed #ccc; padding-bottom: 2px; margin-bottom: 4px; }
          .row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
          .label { font-weight: bold; }
          .items { font-size: 10px; }
          .items div { margin-bottom: 2px; }
          .barcode { text-align: center; margin: 8px 0; }
          .barcode-code { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
          .footer { text-align: center; font-size: 9px; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>VẬN ĐƠN GIAO HÀNG</h2>
          <p>Kích thước A6/K80</p>
        </div>
        <div class="barcode">
          <div class="barcode-code">${order.order_code}</div>
        </div>
        <div class="section">
          <div class="section-title">Thông tin người nhận</div>
          <div class="row"><span class="label">Tên:</span><span>${order.customer_name || ''}</span></div>
          <div class="row"><span class="label">SĐT:</span><span>${order.customer_phone || ''}</span></div>
          <div class="row"><span class="label">Địa chỉ:</span><span>${order.customer_address || ''}</span></div>
        </div>
        <div class="section">
          <div class="section-title">Hàng hóa</div>
          <div class="items">
            ${order.order_items.map((item) => `<div>${item.quantity}x ${item.product_name} ${item.product_variant || ''} - ${formatVND(item.subtotal)}</div>`).join('')}
          </div>
        </div>
        <div class="section">
          <div class="row"><span class="label">Tổng tiền (COD):</span><span>${formatVND(order.total_amount)}</span></div>
          <div class="row"><span class="label">Hình thức:</span><span>${order.payment_status === 'paid' ? 'Đã thanh toán' : 'COD'}</span></div>
        </div>
        <div class="footer">
          CÔNG TY TNHH THỂ THAO THIÊN KIM<br/>
          ${formatDateTime(order.created_at)}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Danh sách đơn hàng & Vận chuyển"
        subtitle="Lọc, theo dõi và xử lý giao hàng"
      />

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <Calendar size={12} /> Ngày
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            value={paymentFilter}
            onChange={setPaymentFilter}
            label="Thanh toán"
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
          </Select>
          <Select
            value={shippingFilter}
            onChange={setShippingFilter}
            label="Giao hàng"
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ giao hàng</option>
            <option value="preparing">Đang chuẩn bị</option>
            <option value="shipped">Đã giao hàng</option>
            <option value="delivered">Đã nhận hàng</option>
            <option value="cancelled">Đã hủy</option>
          </Select>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <Search size={12} /> Tìm kiếm
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mã đơn, tên, SĐT..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Orders table */}
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="Chưa có đơn hàng nào" icon={<Package size={40} />} />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Mã đơn</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Khách hàng</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Ngày</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Tổng tiền</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Thanh toán</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Giao hàng</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{order.order_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{order.customer_name}</p>
                      <p className="text-xs text-slate-400">{order.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatVND(order.total_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={PAYMENT_STATUS_VARIANT[order.payment_status] || 'warning'}>
                        {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={SHIPPING_STATUS_VARIANT[order.shipping_status] || 'warning'}>
                        {SHIPPING_STATUS_LABELS[order.shipping_status] || order.shipping_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => pushToViettelPost(order)}
                          className="p-1.5 rounded text-slate-500 hover:bg-green-100 hover:text-green-700 transition-colors"
                          title="Đẩy Viettel Post"
                        >
                          <Truck size={16} />
                        </button>
                        <button
                          onClick={() => printShippingLabel(order)}
                          className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                          title="In vận đơn"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-mono text-xs font-medium text-blue-700">{order.order_code}</span>
                    <p className="font-medium text-slate-700 mt-0.5">{order.customer_name}</p>
                    <p className="text-xs text-slate-400">{order.customer_phone}</p>
                  </div>
                  <p className="text-right font-bold text-red-600">{formatVND(order.total_amount)}</p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={PAYMENT_STATUS_VARIANT[order.payment_status] || 'warning'}>
                    {PAYMENT_STATUS_LABELS[order.payment_status]}
                  </Badge>
                  <Badge variant={SHIPPING_STATUS_VARIANT[order.shipping_status] || 'warning'}>
                    {SHIPPING_STATUS_LABELS[order.shipping_status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                    <Eye size={14} className="inline mr-1" /> Chi tiết
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => pushToViettelPost(order)}>
                    <Truck size={14} className="inline mr-1" /> Viettel Post
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printShippingLabel(order)}>
                    <Printer size={14} className="inline" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedOrder(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Đơn hàng {selectedOrder.order_code}</h3>
                  <p className="text-sm text-slate-500">{formatDateTime(selectedOrder.created_at)}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Khách hàng</p>
                  <p className="text-sm font-medium text-slate-700">{selectedOrder.customer_name}</p>
                  <p className="text-sm text-slate-600">{selectedOrder.customer_phone}</p>
                  <p className="text-sm text-slate-600">{selectedOrder.customer_address}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Bảng giá</p>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedOrder.price_type === 'hlv' ? 'HLV / Đại lý' : 'Khách lẻ'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Đơn vị vận chuyển: {selectedOrder.shipping_carrier || 'Chưa có'}</p>
                </div>
              </div>

              <div className="mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-medium text-slate-600">Sản phẩm</th>
                      <th className="text-center py-2 font-medium text-slate-600">SL</th>
                      <th className="text-right py-2 font-medium text-slate-600">Đơn giá</th>
                      <th className="text-right py-2 font-medium text-slate-600">T.Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.order_items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-2">
                          <p className="text-sm text-slate-700">{item.product_name}</p>
                          <p className="text-xs text-slate-400">{item.product_variant} | {item.product_sku}</p>
                        </td>
                        <td className="text-center py-2 text-slate-600">{item.quantity}</td>
                        <td className="text-right py-2 text-slate-600">{formatVND(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium text-slate-700">{formatVND(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-right py-3 font-semibold text-slate-700">Tổng cộng:</td>
                      <td className="text-right py-3 font-bold text-red-600">{formatVND(selectedOrder.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={selectedOrder.payment_status}
                  onChange={(v) => updateOrderField(selectedOrder.id, 'payment_status', v)}
                  label="Trạng thái thanh toán"
                >
                  <option value="pending">Chờ thanh toán</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="partial">Thanh toán một phần</option>
                  <option value="refunded">Đã hoàn tiền</option>
                </Select>
                <Select
                  value={selectedOrder.shipping_status}
                  onChange={(v) => updateOrderField(selectedOrder.id, 'shipping_status', v)}
                  label="Trạng thái giao hàng"
                >
                  <option value="pending">Chờ giao hàng</option>
                  <option value="preparing">Đang chuẩn bị</option>
                  <option value="shipped">Đã giao hàng</option>
                  <option value="delivered">Đã nhận hàng</option>
                  <option value="cancelled">Đã hủy</option>
                </Select>
              </div>

              {selectedOrder.note && (
                <div className="mt-4 bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
                  Ghi chú: {selectedOrder.note}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <Button variant="outline" size="md" className="flex-1" onClick={() => printShippingLabel(selectedOrder)}>
                  <Printer size={16} className="inline mr-1.5" /> In vận đơn A6
                </Button>
                <Button variant="success" size="md" className="flex-1" onClick={() => pushToViettelPost(selectedOrder)}>
                  <Truck size={16} className="inline mr-1.5" /> Đẩy Viettel Post
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
