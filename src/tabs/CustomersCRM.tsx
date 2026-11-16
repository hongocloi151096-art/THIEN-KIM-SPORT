import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Upload,
  Crown,
  Medal,
  Award,
  Gift,
  Phone,
  TrendingUp,
  Check,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Customer,
  Order,
  SalesStaff,
  getVipTier,
  VIP_TIERS,
} from '@/lib/types';
import { formatVND, formatDate } from '@/lib/pricing';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Select,
  StatCard,
  EmptyState,
} from '@/components/ui';

interface CustomerRank {
  customer: Customer;
  totalRevenue: number;
  orderCount: number;
  lastOrderDate: string | null;
  staffName: string | null;
}

const VIP_BADGES: Record<string, { label: string; icon: typeof Crown; variant: 'info' | 'warning' | 'neutral' }> = {
  kim_cuong: { label: 'Kim Cương', icon: Crown, variant: 'info' },
  vang: { label: 'Vàng', icon: Medal, variant: 'warning' },
  bac: { label: 'Bạc', icon: Award, variant: 'neutral' },
};

const TET_GIFTS: Record<string, string> = {
  kim_cuong: 'Giày Vovinam cao cấp + Quà Tết hộp cao cấp + Chiết khấu 5% đơn đầu năm',
  vang: 'Đôi đai lụa Vovinam + Hộp bánh Tết doanh nghiệp',
  bac: 'Khăn võ + Hộp mứt Tết tri ân',
  none: 'Thiệp chúc mừng năm mới qua Zalo',
};

export default function CustomersCRM() {
  const [ranks, setRanks] = useState<CustomerRank[]>([]);
  const [staffList, setStaffList] = useState<SalesStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importErr, setImportErr] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [custRes, orderRes, staffRes] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('orders').select('id, customer_id, customer_phone, total_amount, sales_staff_id, created_at'),
      supabase.from('sales_staff').select('*').order('name'),
    ]);

    const customers: Customer[] = custRes.data || [];
    const orders: Order[] = orderRes.data || [];
    setStaffList(staffRes.data || []);

    const staffNameMap = new Map<string, string>();
    (staffRes.data || []).forEach((s) => staffNameMap.set(s.id, s.name));

    const rankMap = new Map<string, CustomerRank>();
    customers.forEach((c) => {
      rankMap.set(c.id, {
        customer: c,
        totalRevenue: 0,
        orderCount: 0,
        lastOrderDate: null,
        staffName: null,
      });
    });

    orders.forEach((o) => {
      let rank: CustomerRank | undefined;
      if (o.customer_id) {
        rank = rankMap.get(o.customer_id);
      }
      if (!rank && o.customer_phone) {
        rank = Array.from(rankMap.values()).find((r) => r.customer.phone === o.customer_phone);
      }
      if (!rank) return;
      rank.totalRevenue += o.total_amount || 0;
      rank.orderCount += 1;
      if (!rank.lastOrderDate || o.created_at > rank.lastOrderDate) {
        rank.lastOrderDate = o.created_at;
      }
      if (o.sales_staff_id && !rank.staffName) {
        rank.staffName = staffNameMap.get(o.sales_staff_id) || null;
      }
    });

    let list = Array.from(rankMap.values()).filter((r) => r.orderCount > 0 || r.totalRevenue > 0);
    list.sort((a, b) => b.totalRevenue - a.totalRevenue);

    setRanks(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRanks = ranks.filter((r) => {
    if (staffFilter && r.staffName !== staffFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.customer.phone.includes(q) ||
      r.customer.name.toLowerCase().includes(q)
    );
  });

  const totalRevenue = ranks.reduce((s, r) => s + r.totalRevenue, 0);
  const vipCount = ranks.filter((r) => getVipTier(r.totalRevenue) !== 'none').length;
  const customerCount = ranks.length;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('');
    setImportErr('');

    const text = await file.text();
    const delimiter = text.includes(';') ? ';' : ',';
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setImportErr('File CSV không có dữ liệu (cần ít nhất 1 dòng tiêu đề + 1 dòng dữ liệu).');
      e.target.value = '';
      return;
    }

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delimiter && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current);
      return result;
    };

    const headers = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
    let success = 0;
    let fail = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
      });

      const phone =
        row['phone'] || row['sdt'] || row['sđt'] || row['dien_thoai'] || row['so_dien_thoai'] || row['tel'] || '';
      const name =
        row['name'] || row['ten'] || row['ho_ten'] || row['khach_hang'] || row['customer'] || '';
      if (!phone) {
        fail++;
        continue;
      }
      const address = row['address'] || row['dia_chi'] || row['diachi'] || '';
      const note = row['note'] || row['ghi_chu'] || row['ghichu'] || '';
      const typeRaw = row['type'] || row['loai'] || row['customer_type'] || 'le';
      const customerType = typeRaw.toLowerCase().includes('hlv') ? 'hlv' : 'le';

      const { error } = await supabase
        .from('customers')
        .upsert(
          {
            phone,
            name: name || 'Khách hàng',
            customer_type: customerType,
            address: address || null,
            note: note || null,
          },
          { onConflict: 'phone' }
        );

      if (error) {
        fail++;
      } else {
        success++;
      }
    }

    setImportMsg(`Đã nhập ${success} khách hàng thành công${fail > 0 ? `, ${fail} lỗi` : ''}.`);
    setTimeout(() => setImportMsg(''), 6000);
    fetchData();
    e.target.value = '';
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
        title="Khách hàng & Quà Tết"
        subtitle="Xếp hạng doanh thu, huy hiệu VIP và gợi ý quà Tết theo khách hàng"
      />

      {importMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700">
          <Check size={16} /> {importMsg}
        </div>
      )}
      {importErr && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} /> {importErr}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng khách hàng" value={String(customerCount)} variant="primary" icon={<Users size={18} className="text-blue-700" />} />
        <StatCard label="Khách VIP" value={String(vipCount)} variant="warning" icon={<Crown size={18} className="text-amber-600" />} />
        <StatCard label="Tổng doanh thu" value={formatVND(totalRevenue)} variant="default" icon={<TrendingUp size={18} className="text-slate-600" />} />
        <StatCard label="TB / khách" value={customerCount ? formatVND(Math.round(totalRevenue / customerCount)) : '0đ'} />
      </div>

      <Card className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo SĐT hoặc tên khách hàng..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select value={staffFilter} onChange={setStaffFilter} className="lg:w-56">
            <option value="">Tất cả nhân viên</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </Select>
          <label className="cursor-pointer">
            <span className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white transition-all">
              <Upload size={16} className="inline mr-1.5" /> Import CSV
            </span>
            <input type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Hỗ trợ file Excel/CSV tiếng Việt (dấu ; hoặc ,). Cột cần: SĐT, Tên. Tương thích file ViettelPost.
        </p>
      </Card>

      {filteredRanks.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="Không có khách hàng nào" icon={<Users size={40} />} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-10">#</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Khách hàng</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">SĐT</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nhân viên</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Doanh thu</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">SL đơn</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Huy hiệu</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Gợi ý quà Tết</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanks.map((r, i) => {
                const tier = getVipTier(r.totalRevenue);
                const badge = tier !== 'none' ? VIP_BADGES[tier] : null;
                const Icon = badge?.icon;
                return (
                  <tr key={r.customer.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-medium">
                      {i < 3 ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                          i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-orange-700'
                        }`}>
                          {i + 1}
                        </span>
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.customer.name}</p>
                      <p className="text-xs text-slate-400">
                        {r.customer.customer_type === 'hlv' ? 'HLV / Đại lý' : 'Khách lẻ'}
                        {r.lastOrderDate && <> · Đơn cuối: {formatDate(r.lastOrderDate)}</>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                        <Phone size={12} className="text-slate-400" /> {r.customer.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{r.staffName || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-800">{formatVND(r.totalRevenue)}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.orderCount}</td>
                    <td className="px-4 py-3 text-center">
                      {badge && Icon ? (
                        <Badge variant={badge.variant}>
                          <Icon size={12} className="inline mr-1" />
                          {badge.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-start gap-1.5 text-xs text-slate-600">
                        <Gift size={14} className="text-red-600 mt-0.5 shrink-0" />
                        <span>{TET_GIFTS[tier]}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-4 mt-6">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-slate-600 uppercase">Phân hạng VIP:</span>
          <Badge variant="info"><Crown size={12} className="inline mr-1" /> Kim Cương ≥ {formatVND(VIP_TIERS.kim_cuong.min)}</Badge>
          <Badge variant="warning"><Medal size={12} className="inline mr-1" /> Vàng ≥ {formatVND(VIP_TIERS.vang.min)}</Badge>
          <Badge variant="neutral"><Award size={12} className="inline mr-1" /> Bạc ≥ {formatVND(VIP_TIERS.bac.min)}</Badge>
        </div>
      </Card>
    </div>
  );
}
