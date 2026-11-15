import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, Award, Gift, Search, Phone, MapPin, ShoppingBag } from 'lucide-react';

interface CustomerStat {
  id: string;
  name: string;
  phone: string;
  address: string;
  customer_type: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
}

export const CustomersCRM: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerStat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerStats();
  }, []);

  const fetchCustomerStats = async () => {
    try {
      setLoading(true);
      // Lấy danh sách khách hàng và đơn hàng từ Supabase
      const { data: custData, error: custError } = await supabase.from('customers').select('*');
      if (custError) throw custError;

      const { data: orderData, error: orderError } = await supabase.from('orders').select('customer_id, total_amount, created_id');
      if (orderError) throw orderError;

      // Tổng hợp doanh thu theo từng khách hàng
      const statsMap: { [key: string]: { orders: number; spent: number; lastDate: string } } = {};
      
      (orderData || []).forEach((ord: any) => {
        if (!ord.customer_id) return;
        if (!statsMap[ord.customer_id]) {
          statsMap[ord.customer_id] = { orders: 0, spent: 0, lastDate: ord.created_at };
        }
        statsMap[ord.customer_id].orders += 1;
        statsMap[ord.customer_id].spent += Number(ord.total_amount || 0);
        if (ord.created_at > statsMap[ord.customer_id].lastDate) {
          statsMap[ord.customer_id].lastDate = ord.created_at;
        }
      });

      const formatted = (custData || []).map((c: any) => ({
        id: c.id,
        name: c.name || 'Khách lẻ',
        phone: c.phone || 'Chưa có SĐT',
        address: c.address || 'Chưa cập nhật',
        customer_type: c.customer_type || 'le',
        total_orders: statsMap[c.id]?.orders || 0,
        total_spent: statsMap[c.id]?.spent || 0,
        last_order_date: statsMap[c.id]?.lastDate || c.created_at
      })).sort((a, b) => b.total_spent - a.total_spent);

      setCustomers(formatted);
    } catch (err) {
      console.error('Lỗi tải dữ liệu khách hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const getVipBadge = (spent: number) => {
    if (spent >= 50000000) return <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1"><Award size={14}/> Kim Cương (VIP 1)</span>;
    if (spent >= 20000000) return <span className="px-2.5 py-1 text-xs font-bold bg-purple-100 text-purple-800 rounded-full flex items-center gap-1"><Award size={14}/> Vàng (VIP 2)</span>;
    if (spent >= 10000000) return <span className="px-2.5 py-1 text-xs font-bold bg-blue-100 text-blue-800 rounded-full flex items-center gap-1"><TrendingUp size={14}/> Bạc (Thân thiết)</span>;
    return <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Khách tiêu chuẩn</span>;
  };

  const getTetGiftSuggestion = (spent: number) => {
    if (spent >= 50000000) return '🎁 Tặng Giỏ quà Tết cao cấp + Lịch độc quyền + Chiết khấu 5% đơn đầu năm';
    if (spent >= 20000000) return '🎁 Tặng Hộp quà Tết doanh nghiệp + Bình khí danh dự Thiên Kim';
    if (spent >= 10000000) return '🎁 Tặng Thiệp Tết + Hộp mứt Tết tri ân';
    return '🧧 Gửi thiệp chúc mừng năm mới Zalo';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" /> Thống kê Doanh thu & Quà Tết Khách hàng
          </h1>
          <p className="text-sm text-gray-500">Quản lý lịch sử mua hàng, xếp hạng VIP và gợi ý chính sách ưu đãi cuối năm</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc SĐT khách..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-xs uppercase tracking-wider border-b">
                <th className="p-4">STT</th>
                <th className="p-4">Khách Hàng / Đơn Vị</th>
                <th className="p-4">Phân Loại</th>
                <th className="p-4 text-center">Tổng Đơn</th>
                <th className="p-4 text-right">Tổng Doanh Thu</th>
                <th className="p-4">Xếp Hạng VIP</th>
                <th className="p-4">Gợi Ý Quà Tết & Ưu Đãi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Đang tải dữ liệu thống kê...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Không tìm thấy khách hàng nào.</td>
                </tr>
              ) : (
                filteredCustomers.map((c, index) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-500 font-medium">{index + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={12}/> {c.address}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${c.customer_type === 'hlv' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                        {c.customer_type === 'hlv' ? 'HLV / Đại Lý' : 'Khách Lẻ / CLB'}
                      </span>
                    </td>
                    <td className="p-4 text-center font-semibold text-gray-700">{c.total_orders}</td>
                    <td className="p-4 text-right font-bold text-blue-600">
                      {c.total_spent.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="p-4">{getVipBadge(c.total_spent)}</td>
                    <td className="p-4 text-xs font-medium text-gray-700">
                      <div className="flex items-center gap-1.5 bg-amber-50 p-2 rounded border border-amber-200">
                        <Gift size={14} className="text-amber-600 shrink-0" />
                        <span>{getTetGiftSuggestion(c.total_spent)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
