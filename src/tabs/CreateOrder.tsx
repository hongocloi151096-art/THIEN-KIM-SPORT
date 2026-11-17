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
  Image as ImageIcon,
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

interface ProductGroup {
  groupKey: string;
  name: string;
  category: string;
  sub_category: string | null;
  image_url: string | null;
  items: Product[];
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

const removeVietnameseAccents = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

function getShortVariantLabel(product: Product): string {
  if (product.sku.startsWith('VP-')) {
    const size = product.sku.split('-').pop() || '';
    return `Size ${size}`;
  }
  if (product.variant) {
    return product.variant.replace(/\s*\([^)]*\)/g, '').trim();
  }
  return product.sku;
}

export default function CreateOrder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [staffList, setStaffList] = useState<SalesStaff[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

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
  const [selectedVariantByGroup, setSelectedVariantByGroup] = useState<Record<string, string>>({});

  const customerAddressRef = useRef(customerAddress);
  customerAddressRef.current = customerAddress;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, supRes, custRes, setRes, staffRes] = await Promise.all([
      supabase.from('products').select('*').order('sku'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('customers').select('*').order('name'),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('sales_staff').select('*').order('name'),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (supRes.data) setSuppliers(supRes.data);
    if (custRes.data) setCustomers(custRes.data);
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
    setCart((prev) =>
      prev.map((item) => {
        const newPrice = getUnitPrice(item.product, priceType, item.quantity);
        return { ...item, unitPrice: newPrice };
      })
    );
  }, [priceType]);

  const handlePhoneChange = (newPhone: string) => {
    setPhone(newPhone);
    const cleanPhone = newPhone.trim();
    if (cleanPhone.length < 8) return;

    const matchedLocal = customers.find((c) => c.phone === cleanPhone);
    if (matchedLocal) {
      setExistingCustomer(matchedLocal);
      if (!customerName.trim()) setCustomerName(matchedLocal.name);
      if (!customerAddress.trim()) setCustomerAddress(matchedLocal.address || '');
      setPriceType(matchedLocal.customer_type === 'hlv' ? 'hlv' : 'le');
    }
  };

  const suggestedCustomers = customers
    .filter((c) => {
      const rawQuery = customerName.trim();
      if (!rawQuery) return true;
      const normalizedQuery = removeVietnameseAccents(rawQuery);
      const normalizedName = removeVietnameseAccents(c.name || '');
      return (
        normalizedName.includes(normalizedQuery) ||
        (c.phone || '').includes(rawQuery)
      );
    })
    .slice(0, 10);

  const handleSelectCustomer = (cust: Customer) => {
    setExistingCustomer(cust);
    setCustomerName(cust.name);
    setPhone(cust.phone);
    setCustomerAddress(cust.address || '');
    setPriceType(cust.customer_type === 'hlv' ? 'hlv' : 'le');
    setShowNameSuggestions(false);
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (selectedSub && (p.sub_category || '') !== selectedSub) return false;
    if (!searchQuery.trim()) return true;
    const q = removeVietnameseAccents(searchQuery);
    return (
      removeVietnameseAccents(p.sku).includes(q) ||
      removeVietnameseAccents(p.name).includes(q) ||
      removeVietnameseAccents(p.variant || '').includes(q)
    );
  });

  // Gom nhóm thông minh các sản phẩm có nhiều size hoặc nhiều chất liệu nhôm
  const groupedProducts: ProductGroup[] = [];
  const groupMap = new Map<string, ProductGroup>();

  for (const p of filteredProducts) {
    const isMultiVariant = p.sku.startsWith('VP-') || p.sku.startsWith('BK-');
    const groupKey = isMultiVariant ? `${p.category}__${p.name}` : p.id;
    let grp = groupMap.get(groupKey);
    if (!grp) {
      grp = {
        groupKey,
        name: p.name,
        category: p.category,
        sub_category: p.sub_category,
        image_url: p.image_url || null,
        items: [],
      };
      groupMap.set(groupKey, grp);
      groupedProducts.push(grp);
    }
    if (!grp.image_url && p.image_url) {
      grp.image_url = p.image_url;
    }
    grp.items.push(p);
  }

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
      const finalName = customerName.trim() || 'Khách lẻ';
      const finalPhone = phone.trim();
      const finalAddress = customerAddress.trim() || null;

      if (!customerId) {
        const matchedByPhone = customers.find((c) => c.phone === finalPhone);
        if (matchedByPhone) {
          customerId = matchedByPhone.id;
          await supabase
            .from('customers')
            .update({ name: finalName, address: finalAddress })
            .eq('id', matchedByPhone.id);
        } else {
          const { data: newCustomer, error: custErr } = await supabase
            .from('customers')
            .insert({
              phone: finalPhone,
              name: finalName,
              customer_type: priceType === 'hlv' ? 'hlv' : 'le',
              address: finalAddress,
            })
            .select()
            .single();
          if (custErr) throw custErr;
          customerId = newCustomer.id;
          setCustomers((prev) => [...prev, newCustomer]);
        }
      } else if (
        existingCustomer &&
        (existingCustomer.address !== finalAddress || existingCustomer.name !== finalName)
      ) {
        await supabase
          .from('customers')
          .update({ name: finalName, address: finalAddress })
          .eq('id', existingCustomer.id);
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === existingCustomer.id ? { ...c, name: finalName, address: finalAddress } : c
          )
        );
      }

      const orderCode = generateOrderCode();
      const firstSupplierId = cart[0]?.supplierId || null;
      const staffId = selectedStaffId || null;

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_code: orderCode,
          customer_id: customerId,
          customer_phone: finalPhone,
          customer_name: finalName,
          customer_address: finalAddress,
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
        finalName,
        finalPhone,
        cart,
        totalAmount,
        bankAccount,
        bankHolder,
        qrUrl
      );

      await supabase.from('message_outbox').insert({
        channel: 'zalo',
        sender_session_key: senderKey,
        recipient: finalPhone,
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
          {/* Thông tin khách hàng */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User size={18} className="text-blue-700" />
              Thông tin khách hàng
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ô 1: Tên khách hàng */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Tên khách hàng *
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    autoComplete="off"
                    value={customerName}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 180)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerName(val);
                      setShowNameSuggestions(true);
                      if (!val.trim()) {
                        setExistingCustomer(null);
                        setPhone('');
                        setCustomerAddress('');
                      } else if (existingCustomer && val !== existingCustomer.name) {
                        setExistingCustomer(null);
                      }
                    }}
                    placeholder="Gõ tên khách hàng để tìm hoặc nhập mới..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {existingCustomer && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <Check size={14} /> Đã chọn: {existingCustomer.name} (
                    {existingCustomer.customer_type === 'hlv' ? 'HLV/Đại lý' : 'Khách lẻ'})
                  </p>
                )}

                {showNameSuggestions && suggestedCustomers.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {suggestedCustomers.map((cust) => (
                      <li
                        key={cust.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCustomer(cust);
                        }}
                        className="px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {cust.name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                                cust.customer_type === 'hlv'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {cust.customer_type === 'hlv' ? 'HLV' : 'Lẻ'}
                            </span>
                            <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                              {cust.phone}
                            </span>
                          </div>
                        </div>
                        {cust.address && (
                          <p className="text-xs text-slate-500 truncate mt-1 flex items-center gap-1">
                            <MapPin size={12} className="shrink-0 text-slate-400" />
                            {cust.address}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Ô 2: Số điện thoại */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Số điện thoại (Zalo) *
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="Nhập SĐT khách hàng"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Ô 3: Địa chỉ giao hàng */}
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
                    type="button"
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
                    type="button"
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

          {/* Chọn sản phẩm theo nhóm + ảnh gốc + chọn nhanh size/chất liệu */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Package size={18} className="text-blue-700" />
              Chọn sản phẩm theo nhóm
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {CATEGORY_CARDS.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.key;
                return (
                  <button
                    type="button"
                    key={cat.key}
                    onClick={() => handleCategoryClick(cat.key)}
                    className={`relative rounded-xl p-4 text-left transition-all border-2 ${
                      active
                        ? 'border-blue-700 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${cat.accent} text-white mb-2`}
                    >
                      <Icon size={18} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{cat.label}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {products.filter((p) => p.category === cat.key).length} mã hàng
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

            {selectedCategory && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                  {SUB_CATEGORIES[selectedCategory]?.length > 4 ? 'Chọn môn võ / nhóm con' : 'Chọn nhóm con'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSub('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !selectedSub
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả
                  </button>
                  {(SUB_CATEGORIES[selectedCategory] || []).map((sub) => (
                    <button
                      type="button"
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

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh theo mã (VD: BX21, VP-VVN) hoặc tên sản phẩm (hỗ trợ không dấu)..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-[520px] overflow-y-auto space-y-2.5 pr-1">
              {groupedProducts.map((grp) => {
                const selectedItemId = selectedVariantByGroup[grp.groupKey] || grp.items[0].id;
                const activeProduct = grp.items.find((i) => i.id === selectedItemId) || grp.items[0];
                const displayPrice = getUnitPrice(activeProduct, priceType, 1);

                return (
                  <div
                    key={grp.groupKey}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all bg-white"
                  >
                    {/* Ảnh gốc sản phẩm */}
                    <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                      {grp.image_url ? (
                        <img
                          src={grp.image_url}
                          alt={grp.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon size={22} className="text-slate-300" />
                      )}
                    </div>

                    {/* Thông tin & Nút chọn nhanh Size / Phân loại */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {activeProduct.sku}
                        </span>
                        {grp.sub_category && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {grp.sub_category}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-800 mt-1">{grp.name}</p>

                      {grp.items.length > 1 ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {grp.items.map((variantItem) => {
                            const isSelected = variantItem.id === activeProduct.id;
                            return (
                              <button
                                key={variantItem.id}
                                type="button"
                                onClick={() =>
                                  setSelectedVariantByGroup((prev) => ({
                                    ...prev,
                                    [grp.groupKey]: variantItem.id,
                                  }))
                                }
                                className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                                  isSelected
                                    ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                                }`}
                              >
                                {getShortVariantLabel(variantItem)}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        activeProduct.variant && (
                          <p className="text-xs text-slate-500 mt-0.5">{activeProduct.variant}</p>
                        )
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">
                          HLV: <span className="font-semibold text-slate-700">{formatVND(activeProduct.price_hlv)}</span>
                        </span>
                        <span className="text-xs text-slate-500">
                          Lẻ: <span className="font-semibold text-red-600">{formatVND(activeProduct.price_le)}</span>
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            activeProduct.stock < 5 ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          Tồn: {activeProduct.stock}
                        </span>
                      </div>
                    </div>

                    {/* Giá áp dụng & Nút Thêm */}
                    <div className="flex flex-col items-end justify-between shrink-0 gap-2">
                      <span
                        className={`text-sm font-bold ${
                          priceType === 'hlv' ? 'text-blue-700' : 'text-red-600'
                        }`}
                      >
                        {formatVND(displayPrice)}
                      </span>
                      <Button
                        size="sm"
                        variant={priceType === 'hlv' ? 'primary' : 'danger'}
                        onClick={() => addToCart(activeProduct)}
                        disabled={activeProduct.stock <= 0}
                      >
                        <Plus size={14} className="inline" /> Thêm
                      </Button>
                    </div>
                  </div>
                );
              })}

              {groupedProducts.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">
                  {selectedCategory ? 'Không có sản phẩm trong nhóm này' : 'Không tìm thấy sản phẩm phù hợp'}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Giỏ hàng + QR */}
        <div className="space-y-6">
          <Card className="p-5 sticky top-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-700" />
              Giỏ hàng ({cart.length})
            </h3>

            {cart.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Chưa có sản phẩm nào trong giỏ</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start gap-2.5">
                      {item.product.image_url && (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-10 h-10 rounded object-contain border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.product.name}</p>
                        <p className="text-xs text-slate-400">
                          {item.product.variant} | {item.product.sku}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
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
                  label="Ghi chú đơn hàng (Màu sắc / Nội dung thêu...)"
                  value={orderNote}
                  onChange={setOrderNote}
                  placeholder="VD: Găng xanh size 10, thêu tên..."
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
