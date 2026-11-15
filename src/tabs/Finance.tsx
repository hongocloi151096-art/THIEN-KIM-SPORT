import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  Banknote,
  CreditCard,
  Truck,
  Save,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Order, Supplier, SupplierDebt } from '@/lib/types';
import { formatVND, formatDate } from '@/lib/pricing';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  StatCard,
  EmptyState,
} from '@/components/ui';

export default function Finance() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [debts, setDebts] = useState<(SupplierDebt & { suppliers: Supplier })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingDebt, setEditingDebt] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [orderRes, supRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    if (orderRes.data) setOrders(orderRes.data);
    if (supRes.data) setSuppliers(supRes.data);

    const { data: debtData } = await supabase
      .from('supplier_debts')
      .select('*, suppliers(*)')
      .eq('month', selectedMonth);
    if (debtData) setDebts(debtData as (SupplierDebt & { suppliers: Supplier })[]);

    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate revenue stats for selected month
  const monthOrders = orders.filter((o) => o.created_at.startsWith(selectedMonth));
  const hlvRevenue = monthOrders
    .filter((o) => o.price_type === 'hlv')
    .reduce((s, o) => s + o.total_amount, 0);
  const leRevenue = monthOrders
    .filter((o) => o.price_type === 'le')
    .reduce((s, o) => s + o.total_amount, 0);
  const totalRevenue = hlvRevenue + leRevenue;

  // Payment method breakdown (VietQR = paid, COD = pending/delivered)
  const paidAmount = monthOrders
    .filter((o) => o.payment_status === 'paid')
    .reduce((s, o) => s + o.total_amount, 0);
  const codAmount = monthOrders
    .filter((o) => o.payment_status !== 'paid')
    .reduce((s, o) => s + o.total_amount, 0);

  // Category revenue
  const categoryRevenue: Record<string, { count: number; total: number }> = {};
  monthOrders.forEach((o) => {
    const type = o.price_type === 'hlv' ? 'HLV / Đại lý' : 'Khách lẻ';
    if (!categoryRevenue[type]) categoryRevenue[type] = { count: 0, total: 0 };
    categoryRevenue[type].count++;
    categoryRevenue[type].total += o.total_amount;
  });

  // Debt summary
  const totalDebt = debts.reduce((s, d) => s + d.closing_balance, 0);
  const totalImport = debts.reduce((s, d) => s + d.monthly_import, 0);
  const totalPaid = debts.reduce((s, d) => s + d.paid_amount, 0);

  const handleSaveDebt = async (debt: SupplierDebt & { suppliers: Supplier }) => {
    const opening = parseInt(editingDebt[`opening_${debt.id}`] ?? String(debt.opening_balance)) || 0;
    const monthlyImport = parseInt(editingDebt[`import_${debt.id}`] ?? String(debt.monthly_import)) || 0;
    const paid = parseInt(editingDebt[`paid_${debt.id}`] ?? String(debt.paid_amount)) || 0;
    const closing = opening + monthlyImport - paid;
    const note = editingDebt[`note_${debt.id}`] ?? (debt.note || '');

    if (debt.id) {
      const { error } = await supabase
        .from('supplier_debts')
        .update({
          opening_balance: opening,
          monthly_import: monthlyImport,
          paid_amount: paid,
          closing_balance: closing,
          note: note || null,
        })
        .eq('id', debt.id);
      if (error) {
        alert('Lỗi lưu: ' + error.message);
        return;
      }
    }
    setDebts((prev) =>
      prev.map((d) =>
        d.id === debt.id
          ? { ...d, opening_balance: opening, monthly_import: monthlyImport, paid_amount: paid, closing_balance: closing, note }
          : d
      )
    );
  };

  const handleAddDebtRow = async (supplierId: string) => {
    if (!supplierId) return;
    const { data, error } = await supabase
      .from('supplier_debts')
      .insert({
        supplier_id: supplierId,
        month: selectedMonth,
        opening_balance: 0,
        monthly_import: 0,
        paid_amount: 0,
        closing_balance: 0,
      })
      .select('*, suppliers(*)')
      .single();
    if (error) {
      if (error.code === '23505') {
        alert('Nhà cung ứng này đã có trong công nợ tháng này');
      } else {
        alert('Lỗi: ' + error.message);
      }
      return;
    }
    setDebts((prev) => [...prev, data as SupplierDebt & { suppliers: Supplier }]);
  };

  const suppliersWithoutDebt = suppliers.filter((s) => !debts.some((d) => d.supplier_id === s.id));

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
        title="Tài chính & Công nợ Nhà cung ứng"
        subtitle="Thống kê doanh thu, dòng tiền và công nợ theo tháng"
      />

      {/* Month selector */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-600">Tháng:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Revenue stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng doanh thu" value={formatVND(totalRevenue)} variant="primary" icon={<TrendingUp size={18} className="text-blue-600" />} />
        <StatCard label="Doanh thu HLV" value={formatVND(hlvRevenue)} variant="success" />
        <StatCard label="Doanh thu Lẻ" value={formatVND(leRevenue)} variant="warning" />
        <StatCard label="Số đơn tháng" value={String(monthOrders.length)} />
      </div>

      {/* Payment breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Banknote size={18} className="text-blue-700" />
            Dòng tiền theo phương thức
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-green-600" />
                <span className="text-sm font-medium text-slate-700">VietQR (Đã thanh toán)</span>
              </div>
              <span className="font-bold text-green-700">{formatVND(paidAmount)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-amber-600" />
                <span className="text-sm font-medium text-slate-700">COD (Chưa thanh toán)</span>
              </div>
              <span className="font-bold text-amber-700">{formatVND(codAmount)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border-t-2 border-slate-200 mt-2">
              <span className="text-sm font-semibold text-slate-700">Tổng cộng</span>
              <span className="font-bold text-slate-800">{formatVND(paidAmount + codAmount)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-700" />
            Doanh thu theo nhóm khách
          </h3>
          <div className="space-y-3">
            {Object.entries(categoryRevenue).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-slate-700">{type}</span>
                  <p className="text-xs text-slate-400">{data.count} đơn</p>
                </div>
                <span className="font-bold text-blue-700">{formatVND(data.total)}</span>
              </div>
            ))}
            {Object.keys(categoryRevenue).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Chưa có dữ liệu trong tháng này</p>
            )}
          </div>
        </Card>
      </div>

      {/* Supplier Debt */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Wallet size={18} className="text-blue-700" />
            Bảng công nợ Nhà cung ứng - Tháng {selectedMonth}
          </h3>
          {suppliersWithoutDebt.length > 0 && (
            <Select
              value=""
              onChange={(v) => v && handleAddDebtRow(v)}
              className="w-auto"
            >
              <option value="">+ Thêm nhà cung ứng</option>
              {suppliersWithoutDebt.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}
        </div>

        {/* Debt summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">Tổng nhập tháng</p>
            <p className="font-bold text-blue-700">{formatVND(totalImport)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">Đã thanh toán</p>
            <p className="font-bold text-green-700">{formatVND(totalPaid)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">Dư cuối kỳ</p>
            <p className="font-bold text-red-600">{formatVND(totalDebt)}</p>
          </div>
        </div>

        {debts.length === 0 ? (
          <EmptyState message="Chưa có công nợ nào trong tháng này. Thêm nhà cung ứng để bắt đầu." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Nhà cung ứng</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Dư đầu kỳ</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Nhập trong tháng</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Đã thanh toán</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Dư cuối kỳ</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Lưu</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((debt) => {
                  const opening = parseInt(editingDebt[`opening_${debt.id}`] ?? String(debt.opening_balance)) || 0;
                  const monthlyImport = parseInt(editingDebt[`import_${debt.id}`] ?? String(debt.monthly_import)) || 0;
                  const paid = parseInt(editingDebt[`paid_${debt.id}`] ?? String(debt.paid_amount)) || 0;
                  const closing = opening + monthlyImport - paid;

                  return (
                    <tr key={debt.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-700">{debt.suppliers?.name || 'N/A'}</p>
                        {debt.note && <p className="text-xs text-slate-400">{debt.note}</p>}
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          value={editingDebt[`opening_${debt.id}`] ?? debt.opening_balance}
                          onChange={(e) => setEditingDebt({ ...editingDebt, [`opening_${debt.id}`]: e.target.value })}
                          className="w-28 px-2 py-1 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          value={editingDebt[`import_${debt.id}`] ?? debt.monthly_import}
                          onChange={(e) => setEditingDebt({ ...editingDebt, [`import_${debt.id}`]: e.target.value })}
                          className="w-28 px-2 py-1 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          value={editingDebt[`paid_${debt.id}`] ?? debt.paid_amount}
                          onChange={(e) => setEditingDebt({ ...editingDebt, [`paid_${debt.id}`]: e.target.value })}
                          className="w-28 px-2 py-1 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-bold ${closing > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatVND(closing)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleSaveDebt(debt)}
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                          title="Lưu"
                        >
                          <Save size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">
          Công thức: Dư cuối kỳ = Dư đầu kỳ + Nhập trong tháng - Đã thanh toán
        </p>
      </Card>
    </div>
  );
}
