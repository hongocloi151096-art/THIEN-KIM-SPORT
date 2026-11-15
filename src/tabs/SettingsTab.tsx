import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Check,
  Link as LinkIcon,
  Copy,
  Key,
  Banknote,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Settings, Supplier, Product } from '@/lib/types';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Badge,
} from '@/components/ui';

export default function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [formData, setFormData] = useState({
    zalo_oa_api_key: '',
    viettel_post_api_key: '',
    viettel_post_customer_code: '',
    mb_bank_account: '',
    mb_bank_holder: '',
    sacombank_account: '',
    sacombank_holder: '',
    company_name: '',
  });

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', type: 'may', phone: '', zalo: '', address: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [setRes, supRes, prodRes] = await Promise.all([
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('products').select('*').order('name').limit(5),
    ]);
    if (setRes.data) {
      setSettings(setRes.data);
      setFormData({
        zalo_oa_api_key: setRes.data.zalo_oa_api_key || '',
        viettel_post_api_key: setRes.data.viettel_post_api_key || '',
        viettel_post_customer_code: setRes.data.viettel_post_customer_code || '',
        mb_bank_account: setRes.data.mb_bank_account || '',
        mb_bank_holder: setRes.data.mb_bank_holder || '',
        sacombank_account: setRes.data.sacombank_account || '',
        sacombank_holder: setRes.data.sacombank_holder || '',
        company_name: setRes.data.company_name || '',
      });
    }
    if (supRes.data) setSuppliers(supRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    if (settings?.id) {
      const { error } = await supabase
        .from('settings')
        .update({
          zalo_oa_api_key: formData.zalo_oa_api_key || null,
          viettel_post_api_key: formData.viettel_post_api_key || null,
          viettel_post_customer_code: formData.viettel_post_customer_code || null,
          mb_bank_account: formData.mb_bank_account || null,
          mb_bank_holder: formData.mb_bank_holder || null,
          sacombank_account: formData.sacombank_account || null,
          sacombank_holder: formData.sacombank_holder || null,
          company_name: formData.company_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);
      if (error) {
        alert('Lỗi lưu: ' + error.message);
      } else {
        setSavedMsg('Đã lưu cài đặt thành công');
        setTimeout(() => setSavedMsg(''), 3000);
      }
    } else {
      const { data, error } = await supabase
        .from('settings')
        .insert({
          zalo_oa_api_key: formData.zalo_oa_api_key || null,
          viettel_post_api_key: formData.viettel_post_api_key || null,
          viettel_post_customer_code: formData.viettel_post_customer_code || null,
          mb_bank_account: formData.mb_bank_account || null,
          mb_bank_holder: formData.mb_bank_holder || null,
          sacombank_account: formData.sacombank_account || null,
          sacombank_holder: formData.sacombank_holder || null,
          company_name: formData.company_name || null,
        })
        .select()
        .single();
      if (error) {
        alert('Lỗi: ' + error.message);
      } else {
        setSettings(data);
        setSavedMsg('Đã lưu cài đặt thành công');
        setTimeout(() => setSavedMsg(''), 3000);
      }
    }
    setSaving(false);
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name) {
      alert('Vui lòng nhập tên nhà cung ứng');
      return;
    }
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: newSupplier.name,
        type: newSupplier.type,
        contact_phone: newSupplier.phone || null,
        contact_zalo: newSupplier.zalo || null,
        address: newSupplier.address || null,
      })
      .select()
      .single();
    if (error) {
      alert('Lỗi: ' + error.message);
      return;
    }
    setSuppliers((prev) => [...prev, data]);
    setNewSupplier({ name: '', type: 'may', phone: '', zalo: '', address: '' });
    setShowSupplierForm(false);
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Xóa nhà cung ứng này?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
      alert('Lỗi: ' + error.message);
      return;
    }
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  const copyOrderLink = async () => {
    const link = window.location.origin + '#order-form';
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      alert('Link: ' + link);
    }
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
        title="Cài đặt & Link khách tự đặt"
        subtitle="Cấu hình API, tài khoản ngân hàng và link đặt hàng công khai"
      />

      {savedMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
          <Check size={16} /> {savedMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Configuration */}
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Key size={18} className="text-blue-700" />
            Cấu hình API
          </h3>
          <div className="space-y-4">
            <Input
              label="Zalo OA API Key"
              value={formData.zalo_oa_api_key}
              onChange={(v) => setFormData({ ...formData, zalo_oa_api_key: v })}
              placeholder="Nhập Zalo OA API Key"
            />
            <Input
              label="Viettel Post API Key"
              value={formData.viettel_post_api_key}
              onChange={(v) => setFormData({ ...formData, viettel_post_api_key: v })}
              placeholder="Nhập Viettel Post API Key"
            />
            <Input
              label="Mã khách hàng Viettel Post"
              value={formData.viettel_post_customer_code}
              onChange={(v) => setFormData({ ...formData, viettel_post_customer_code: v })}
              placeholder="VD: VTP123456"
            />
          </div>
        </Card>

        {/* Bank Accounts */}
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Banknote size={18} className="text-blue-700" />
            Tài khoản ngân hàng
          </h3>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 uppercase mb-2">MB Bank</p>
              <Input label="Số tài khoản" value={formData.mb_bank_account} onChange={(v) => setFormData({ ...formData, mb_bank_account: v })} placeholder="0973166839" />
              <div className="mt-2">
                <Input label="Chủ tài khoản" value={formData.mb_bank_holder} onChange={(v) => setFormData({ ...formData, mb_bank_holder: v })} placeholder="CONG TY TNHH THE THAO THIEN KIM" />
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 uppercase mb-2">Sacombank</p>
              <Input label="Số tài khoản" value={formData.sacombank_account} onChange={(v) => setFormData({ ...formData, sacombank_account: v })} placeholder="060199565837" />
              <div className="mt-2">
                <Input label="Chủ tài khoản" value={formData.sacombank_holder} onChange={(v) => setFormData({ ...formData, sacombank_holder: v })} placeholder="CONG TY TNHH THE THAO THIEN KIM" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSaveSettings} disabled={saving}>
          {saving ? 'Đang lưu...' : <><Save size={16} className="inline mr-1.5" /> Lưu cài đặt</>}
        </Button>
      </div>

      {/* Public order link */}
      <Card className="p-5 mt-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <LinkIcon size={18} className="text-blue-700" />
          Link khách tự đặt hàng
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Gửi link này cho khách lẻ/HLV để họ tự chọn size và đặt hàng. Form hiển thị danh sách sản phẩm công khai.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600 truncate">
            {window.location.origin}/#order-form
          </div>
          <Button variant={copiedLink ? 'success' : 'outline'} onClick={copyOrderLink}>
            {copiedLink ? <><Check size={16} className="inline mr-1" /> Đã copy</> : <><Copy size={16} className="inline mr-1" /> Copy link</>}
          </Button>
        </div>

        {/* Preview of public form */}
        <div className="mt-6 border border-slate-200 rounded-lg p-5 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase mb-3">Xem trước form đặt hàng công khai</p>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <h4 className="font-bold text-slate-800 text-center mb-1">THỂ THAO THIÊN KIM</h4>
            <p className="text-xs text-center text-slate-500 mb-4">Form đặt hàng trực tuyến</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input disabled placeholder="Họ tên" className="px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50" />
              <input disabled placeholder="SĐT" className="px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50" />
              <input disabled placeholder="Địa chỉ" className="px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50 col-span-2" />
              <select disabled className="px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50 col-span-2">
                <option>Chọn sản phẩm...</option>
                {products.map((p) => (
                  <option key={p.id}>{p.name} {p.variant}</option>
                ))}
              </select>
              <select disabled className="px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50">
                <option>Size</option>
              </select>
              <input disabled placeholder="Số lượng" type="number" className="px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50" />
            </div>
            <button disabled className="w-full py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium opacity-60">
              Gửi đặt hàng
            </button>
          </div>
        </div>
      </Card>

      {/* Supplier management */}
      <Card className="p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Truck size={18} className="text-blue-700" />
            Quản lý Nhà cung ứng
          </h3>
          <Button variant="primary" size="sm" onClick={() => setShowSupplierForm(!showSupplierForm)}>
            + Thêm nhà cung ứng
          </Button>
        </div>

        {showSupplierForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-4 bg-blue-50 rounded-lg">
            <Input label="Tên xưởng/NCC" value={newSupplier.name} onChange={(v) => setNewSupplier({ ...newSupplier, name: v })} placeholder="VD: Xưởng may A" />
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Loại</label>
              <select
                value={newSupplier.type}
                onChange={(e) => setNewSupplier({ ...newSupplier, type: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="may">Xưởng may</option>
                <option value="binhkhi">Binh khí</option>
                <option value="dungcu">Dụng cụ</option>
                <option value="aothun">Áo thun</option>
                <option value="general">Khác</option>
              </select>
            </div>
            <Input label="SĐT" value={newSupplier.phone} onChange={(v) => setNewSupplier({ ...newSupplier, phone: v })} placeholder="SĐT" />
            <Input label="Zalo" value={newSupplier.zalo} onChange={(v) => setNewSupplier({ ...newSupplier, zalo: v })} placeholder="Zalo" />
            <Input label="Địa chỉ" value={newSupplier.address} onChange={(v) => setNewSupplier({ ...newSupplier, address: v })} placeholder="Địa chỉ" />
            <div className="flex items-end">
              <Button variant="primary" onClick={handleAddSupplier}>Lưu</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <div>
                <p className="font-medium text-slate-700">{s.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <Badge variant="info">{s.type}</Badge>
                  {s.contact_phone && <span className="text-xs text-slate-400">SĐT: {s.contact_phone}</span>}
                  {s.contact_zalo && <span className="text-xs text-slate-400">Zalo: {s.contact_zalo}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDeleteSupplier(s.id)}
                className="text-slate-400 hover:text-red-600 transition-colors text-sm"
              >
                Xóa
              </button>
            </div>
          ))}
          {suppliers.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Chưa có nhà cung ứng nào</p>
          )}
        </div>
      </Card>
    </div>
  );
}
