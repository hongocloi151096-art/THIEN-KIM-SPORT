import { useState } from 'react';
import {
  ShoppingCart,
  Package,
  ClipboardList,
  Users,
  Warehouse,
  Wallet,
  Settings,
  Menu,
  X,
  Flame,
} from 'lucide-react';
import CreateOrder from '@/tabs/CreateOrder';
import OrdersList from '@/tabs/OrdersList';
import DailyConsolidation from '@/tabs/DailyConsolidation';
import CustomersCRM from '@/tabs/CustomersCRM';
import Inventory from '@/tabs/Inventory';
import Finance from '@/tabs/Finance';
import SettingsTab from '@/tabs/SettingsTab';

type TabId =
  | 'create-order'
  | 'orders'
  | 'consolidation'
  | 'crm'
  | 'inventory'
  | 'finance'
  | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof ShoppingCart;
}

const TABS: TabDef[] = [
  { id: 'create-order', label: 'Tạo đơn hàng', icon: ShoppingCart },
  { id: 'orders', label: 'Đơn hàng & Vận chuyển', icon: Package },
  { id: 'consolidation', label: 'Chốt đơn 12h', icon: ClipboardList },
  { id: 'crm', label: 'Khách hàng & Quà Tết', icon: Users },
  { id: 'inventory', label: 'Kho & Bảng giá', icon: Warehouse },
  { id: 'finance', label: 'Tài chính & Công nợ', icon: Wallet },
  { id: 'settings', label: 'Cài đặt & Kết nối', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('create-order');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* Mobile header */}
      <header
        className="lg:hidden text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md"
        style={{ backgroundColor: '#1E3A8A' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-600">
              <Flame size={16} />
            </span>
            <span className="font-bold text-sm">Thiên Kim Sports</span>
          </div>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <nav className="lg:hidden bg-white border-b border-slate-200 shadow-lg z-20">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium border-b border-slate-100 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-900 border-l-4 border-l-red-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 text-white min-h-screen sticky top-0"
        style={{ backgroundColor: '#1E3A8A' }}
      >
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-600 shadow-sm">
              <Flame size={18} />
            </span>
            <div>
              <h1 className="font-bold text-base leading-tight">Thiên Kim Sports</h1>
              <p className="text-blue-200 text-xs mt-0.5">POS Quản lý Bán hàng</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all relative group ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-blue-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 rounded-r" />
                )}
                <Icon
                  size={18}
                  className={active ? 'text-red-400' : 'text-blue-300 group-hover:text-white'}
                />
                <span className="flex-1 text-left">{tab.label}</span>
                {idx === 2 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                    12H
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-blue-200">
          <p className="font-medium text-blue-100">Công ty TNHH</p>
          <p>Thể Thao Thiên Kim</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {activeTab === 'create-order' && <CreateOrder />}
          {activeTab === 'orders' && <OrdersList />}
          {activeTab === 'consolidation' && <DailyConsolidation />}
          {activeTab === 'crm' && <CustomersCRM />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'finance' && <Finance />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
