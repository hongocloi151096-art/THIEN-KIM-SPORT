import { useState, useEffect, useCallback, useRef } from 'react';
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
  Shirt,
  Swords,
  Shield,
  Users as UsersIcon,
  Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Product,
  Customer,
  Supplier,
  Settings,
  SalesStaff,
  SUB_CATEGORIES,
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
  Input,
} from '@/components/ui';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  supplierId: string | null;
}

interface CategoryCard {
  key: string;
  label: string;
  icon: typeof Shirt;
  accent: string;
}

const CATEGORY_CARDS: CategoryCard[] = [
  { key: 'Võ phục & Phụ kiện', label: 'Võ phục & Phụ kiện', icon: Shirt, accent: 'from-blue-500 to-blue-700' },
  { key: 'Dụng cụ võ thuật', label: 'Dụng cụ võ thuật', icon: Shield, accent: 'from-amber-500 to-amber-700' },
  { key: 'Binh khí Vovinam', label: 'Binh khí Vovinam', icon: Swords, accent: 'from-red-500 to-red-700' },
  { key: 'Áo thun & Đồng phục', label: 'Áo thun & Đồng phục', icon: UsersIcon, accent: 'from-emerald-500 to-emerald-700' },
];

const STAFF_LS_KEY = 'tk_selected_staff_id';

export default function CreateOrder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [staffList, setStaffList] = useState<SalesStaff[]>([]);
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
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSub, setSelectedSub] = useState<string>('');

  const customerAddressRef = useRef(customerAddress);
  customerAddressRef.current = customerAddress;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, supRes, setRes, staffRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('sales_staff').select('*').order('name'),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (supRes.data) setSuppliers(supRes.data);
    if (setRes.data) setSettings(setRes.data);
    if (staffRes.data) setStaffList(staffRes.data);
    const savedStaff = localStorage.getItem(STAFF_LS_KEY);
    if (savedStaff) setSelectedStaffId(savedStaff);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedStaffId) localStorage.setItem(STAFF_LS_KEY, selectedStaffId);
  }, [selectedStaffId]);

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

  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => {
        const newPrice = getUnitPrice(item.product, priceType, item.quantity);
        return { ...item, unitPrice: newPrice };
      })
    );
  }, [priceType]);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (selectedSub && (p.sub_category || '') !== selectedSub) return false;
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

  const handleCategoryClick = (cat: string) => {
    if (selectedCategory === cat) {
      setSelectedCategory('');
      setSelectedSub('');
    } else {
      setSelectedCategory(cat);
      setSelectedSub('');
    }
  };

  const buildOrderMessage = (
    orderCode: string,
    custName: string,
    custPhone: string,
    items: CartItem[],
    total: number,
    bankAccount: string,
    bankHolder: string,
    qrUrl: string
  ): string => {
    const lines: string[] = [];
    lines.push(`=== THIEN KIM SPORTS ===`);
    lines.push(`Don hang: ${orderCode}`);
    lines.push(`Khach hang: ${custName}`);
    lines.push(`SDT: ${custPhone}`);
    if (customerAddressRef.current.trim()) {
      lines.push(`Dia chi: ${customerAddressRef.current.trim()}`);
    }
    lines.push(`---------------------------`);
    items.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.product.name} ${it.product.variant || ''} (${it.product.sku})`);
      lines.push(`   SL: ${it.quantity} | Don gia: ${formatVND(it.unitPrice)} | T.tien: ${formatVND(it.unitPrice * it.quantity)}`);
    });
    lines.push(`---------------------------`);
    lines.push(`TONG: ${formatVND(total)}`);
    lines.push(``);
    lines.push(`Chuyen khoan MB Bank:`);
    lines.push(`STK: ${bankAccount}`);
    lines.push(`Chu TK: ${bankHolder}`);
    lines.push(`Noi dung: ${orderCode}`);
    if (qrUrl) lines.push(`QR VietQR: ${qrUrl}`);
    lines.push(`Cam on quy khach!`);
    return lines.join('\n');
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
      const staffId = selectedStaffId || null;

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
          sales_staff_id: staffId,
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
        supplier_id: item.supplierId || null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, item.product.stock - item.quantity) })
          .eq('id', item.product.id);
      }

      setProducts((prev) =>
        prev.map((p) => {
          const cartItem = cart.find((c) => c.product.id === p.id);
          if (cartItem) return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
          return p;
        })
      );

      const staff = staffList.find((s) => s.id === staffId) || null;
      const senderKey = staff?.zalo_session_key || null;
      const bankAccount = settings?.mb_bank_account || '';
      const bankHolder = settings?.mb_bank_holder || '';
      const qrUrl = bankAccount
        ? generateVietQRUrl(bankAccount, totalAmount, `THIENKIM ${orderCode.slice(0, 12)}`)
        : '';
      const content = buildOrderMessage(
        orderCode,
        customerName.trim() || 'Khách lẻ',
        phone.trim(),
        cart,
        totalAmount,
        bankAccount,
        bankHolder,
        qrUrl
      );

      await supabase.from('message_outbox').insert({
        channel: 'zalo',
        sender_session_key: senderKey,
        recipient: phone.trim(),
        recipient_type: 'phone',
        content,
        status: 'pending',
        related_order_id: order.id,
      });

      setSuccessMsg(`Đã tạo đơn ${orderCode} thành công! Đã trừ kho và thêm tin nhắn Zalo vào hàng đợi.`);
      setCart([]);
      setPhone('');
      setCustomerName('');
      setCustomerAddress('');
      setOrderNote('');
      setExistingCustomer(null);

      setTimeout(() => setSuccessMsg(''), 6000);
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
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <Check className="text-green-600 mt-0.5" size={20} />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5" size={20} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Nhân viên tạo đơn
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Lựa chọn được tự nhớ trên trình duyệt.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Bảng giá áp dụng</label>
                <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                  <button
                    onClick={() => setPriceType('hlv')}
                    className={`px-4 py-2.5 text-sm font-medium transition-all ${
                      priceType === 'hlv'
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Giá HLV/Đại lý
                  </button>
                  <button
                    onClick={() => setPriceType('le')}
                    className={`px-4 py-2.5 text-sm font-medium transition-all border-l border-slate-300 ${
                      priceType === 'le'
                        ? 'bg-red-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Giá Lẻ
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Two-tier product selection */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Package size={18} className="text-blue-700" />
              Chọn sản phẩm theo nhóm
            </h3>

            {/* Tier 1 - Category cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {CATEGORY_CARDS.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryClick(cat.key)}
                    className={`relative rounded-xl p-4 text-left transition-all border-2 ${
                      active
                        ? 'border-blue-700 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${cat.accent} text-white mb-2`}>
                      <Icon size={18} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{cat.label}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {products.filter((p) => p.category === cat.key).length} sản phẩm
                    </p>
                    {active && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tier 2 - sub_category filter */}
            {selectedCategory && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                  {SUB_CATEGORIES[selectedCategory].length > 4 ? 'Chọn môn võ / nhóm con' : 'Chọn nhóm con'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSub('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !selectedSub
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả
                  </button>
                  {SUB_CATEGORIES[selectedCategory].map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSub(sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedSub === sub
                          ? 'bg-red-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
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
                      {product.sub_category && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {product.sub_category}
                        </span>
                      )}
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
                <p className="text-center text-sm text-slate-400 py-6">
                  {selectedCategory ? 'Không có sản phẩm trong nhóm này' : 'Không tìm thấy sản phẩm'}
                </p>
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
                  {submitting ? (
                    'Đang tạo đơn...'
                  ) : (
                    <>
                      <Send size={16} className="inline mr-1.5" /> Tạo đơn & Trừ kho
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Tự động gửi tin nhắn Zalo (chi tiết đơn + QR) cho khách.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
