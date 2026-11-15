import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Trash2,
  ShoppingCart,
  QrCode,
  Phone,
  User,
  MapPin,
  Check,
  AlertCircle,
  Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Product,
  Customer,
  Supplier,
  Settings,
} from '@/lib/types';
import {
  PriceType,
  getUnitPrice,
  formatVND,
} from '@/lib/pricing';
import {
  generateVietQRUrl,
  generateOrderCode,
} from '@/lib/vietqr';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  StatCard,
} from '@/components/ui';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  supplierId: string | null;
}

export default function CreateOrder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [priceType, setPriceType] = useState<PriceType>('le');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, supRes, setRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('settings').select('*').maybeSingle(),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (supRes.data) setSuppliers(supRes.data);
    if (setRes.data) setSettings(setRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search customer by phone
  useEffect(() => {
    if (phone.length < 8) {
      setExistingCustomer(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      if (data) {
        setExistingCustomer(data);
        setCustomerName(data.name);
        setCustomerAddress(data.address || '');
      } else {
        setExistingCustomer(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [phone]);

  // Recalculate cart prices when price type changes
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => {
        const newPrice = getUnitPrice(item.product, priceType, item.quantity);
        return { ...item, unitPrice: newPrice };
      })
    );
  }, [priceType]);

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.variant || '').toLowerCase().includes(q)
    );
  });

  const totalAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        const newPrice = getUnitPrice(product, priceType, newQty);
        return prev.map((c) =>
          c.product.id === product.id
            ? { ...c, quantity: newQty, unitPrice: newPrice }
            : c
        );
      }
      const unitPrice = getUnitPrice(product, priceType, 1);
      return [...prev, { product, quantity: 1, unitPrice, supplierId: product.default_supplier_id }];
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== productId) return c;
        const newPrice = getUnitPrice(c.product, priceType, qty);
        return { ...c, quantity: qty, unitPrice: newPrice };
      })
    );
  };

  const updateSupplier = (productId: string, supplierId: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.product.id === productId
          ? { ...c, supplierId: supplierId || null }
          : c
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một sản phẩm vào đơn hàng.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại khách hàng.');
      return;
    }

    setSubmitting(true);

    try {
      let customerId = existingCustomer?.id || null;

      if (!customerId) {
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert({
            phone: phone.trim(),
            name: customerName.trim() || 'Khách lẻ',
            customer_type: priceType === 'hlv' ? 'hlv' : 'le',
            address: customerAddress.trim() || null,
          })
          .select()
          .single();
        if (custErr) throw custErr;
        customerId = newCustomer.id;
      }

      const orderCode = generateOrderCode();
      const firstSupplierId = cart[0]?.supplierId || null;

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_code: orderCode,
          customer_id: customerId,
          customer_phone: phone.trim(),
          customer_name: customerName.trim() || 'Khách lẻ',
          customer_address: customerAddress.trim() || null,
          price_type: priceType,
          total_amount: totalAmount,
          payment_status: 'pending',
          shipping_status: 'pending',
          supplier_id: firstSupplierId,
          note: orderNote.trim() || null,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        product_sku: item.product.sku,
        product_name: item.product.name,
        product_variant: item.product.variant,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Deduct stock
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, item.product.stock - item.quantity) })
          .eq('id', item.product.id);
      }

      // Update local product stock
      setProducts((prev) =>
        prev.map((p) => {
          const cartItem = cart.find((c) => c.product.id === p.id);
          if (cartItem) return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
          return p;
        })
      );

      setSuccessMsg(`Đã tạo đơn hàng ${orderCode} thành công! Kho đã được trừ tự động.`);
      setCart([]);
      setPhone('');
      setCustomerName('');
      setCustomerAddress('');
      setOrderNote('');
      setExistingCustomer(null);

      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(`Lỗi tạo đơn: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const qrUrl = settings?.mb_bank_account
    ? generateVietQRUrl(
        settings.mb_bank_account,
        totalAmount,
        `THIENKIM ${cart.length > 0 ? generateOrderCode().slice(0, 12) : ''}`
      )
    : '';

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
        title="Tạo đơn hàng mới"
        subtitle="Tạo đơn, áp bảng giá HLV/Lẻ và trừ kho tự động"
      />

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <Check className="text-green-600 mt-0.5" size={20} />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5" size={20} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Customer info + Product search */}
        <div className="xl:col-span-2 space-y-6">
          {/* Customer info */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User size={18} className="text-blue-700" />
              Thông tin khách hàng
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Số điện thoại *
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Nhập SĐT khách hàng"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {existingCustomer && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <Check size={14} /> Khách cũ: {existingCustomer.name}
                  </p>
                )}
              </div>
              <Input label="Tên khách hàng" value={customerName} onChange={setCustomerName} placeholder="Tên khách" />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Địa chỉ giao hàng</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Địa chỉ nhận hàng"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Price type toggle */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-600 mb-2">Bảng giá áp dụng</label>
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setPriceType('hlv')}
                  className={`px-5 py-2.5 text-sm font-medium transition-all ${
                    priceType === 'hlv'
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Bảng giá HLV/Đại lý
                </button>
                <button
                  onClick={() => setPriceType('le')}
                  className={`px-5 py-2.5 text-sm font-medium transition-all border-l border-slate-300 ${
                    priceType === 'le'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Bảng giá Lẻ
                </button>
              </div>
            </div>
          </Card>

          {/* Product search */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Package size={18} className="text-blue-700" />
              Tìm sản phẩm
            </h3>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo mã SKU hoặc tên sản phẩm..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {product.sku}
                      </span>
                      {product.variant && (
                        <span className="text-xs text-slate-500">{product.variant}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-700 mt-1 truncate">{product.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">
                        HLV: <span className="font-medium text-slate-700">{formatVND(product.price_hlv)}</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        Lẻ: <span className="font-medium text-red-600">{formatVND(product.price_le)}</span>
                      </span>
                      <span className={`text-xs font-medium ${product.stock < 5 ? 'text-red-600' : 'text-slate-500'}`}>
                        Tồn: {product.stock}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={priceType === 'hlv' ? 'primary' : 'danger'}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className="ml-3 shrink-0"
                  >
                    <Plus size={14} className="inline" /> Thêm
                  </Button>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-6">Không tìm thấy sản phẩm</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Cart + QR */}
        <div className="space-y-6">
          <Card className="p-5 sticky top-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-700" />
              Giỏ hàng ({cart.length})
            </h3>

            {cart.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Chưa có sản phẩm nào trong giỏ</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.product.name}</p>
                        <p className="text-xs text-slate-400">{item.product.variant} | {item.product.sku}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        +
                      </button>
                      <span className="text-sm text-slate-600 ml-auto">
                        {formatVND(item.unitPrice)} × {item.quantity}
                      </span>
                    </div>
                    <div className="mt-2">
                      <select
                        value={item.supplierId || ''}
                        onChange={(e) => updateSupplier(item.product.id, e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-slate-600 bg-white"
                      >
                        <option value="">-- Chọn xưởng --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-right text-sm font-bold text-blue-700 mt-1.5">
                      {formatVND(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <>
                <div className="border-t border-slate-200 mt-4 pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-500">Số sản phẩm:</span>
                    <span className="text-sm font-medium text-slate-700">
                      {cart.reduce((s, i) => s + i.quantity, 0)} cái
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-slate-700">Tổng tiền:</span>
                    <span className="text-xl font-bold text-red-600">{formatVND(totalAmount)}</span>
                  </div>
                </div>

                <Input
                  label="Ghi chú đơn hàng"
                  value={orderNote}
                  onChange={setOrderNote}
                  placeholder="Ghi chú (nếu có)"
                  className="mt-4"
                />

                {/* VietQR */}
                {qrUrl && totalAmount > 0 && (
                  <div className="mt-4 border border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-2 flex items-center justify-center gap-1">
                      <QrCode size={14} /> Quét mã VietQR để thanh toán
                    </p>
                    <img src={qrUrl} alt="VietQR" className="mx-auto rounded-lg" width={200} height={200} />
                    <p className="text-xs text-slate-500 mt-2">
                      MB Bank: {settings?.mb_bank_account}
                    </p>
                  </div>
                )}

                <Button
                  variant="success"
                  size="lg"
                  className="w-full mt-4"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Đang tạo đơn...' : 'Tạo đơn & Trừ kho'}
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
