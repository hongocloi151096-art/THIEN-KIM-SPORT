import { useState } from 'react';
import {
  ShoppingCart,
  Package,
  ClipboardList,
  Warehouse,
  Wallet,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import CreateOrder from '@/tabs/CreateOrder';
import OrdersList from '@/tabs/OrdersList';
import DailyConsolidation from '@/tabs/DailyConsolidation';
import Inventory from '@/tabs/Inventory';
import Finance from '@/tabs/Finance';
import SettingsTab from '@/tabs/SettingsTab';

type TabId = 'create-order' | 'orders' | 'consolidation' | 'inventory' | 'finance' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof ShoppingCart;
}

const TABS: TabDef[] = [
  { id: 'create-order', label: 'Tạo đơn hàng', icon: ShoppingCart },
  { id: 'orders', label: 'Đơn hàng & Vận chuyển', icon: Package },
  { id: 'consolidation', label: 'Chốt đơn 12h', icon: ClipboardList },
  { id: 'inventory', label: 'Kho & Bảng giá', icon: Warehouse },
  { id: 'finance', label: 'Tài chính & Công nợ', icon: Wallet },
  { id: 'settings', label: 'Cài đặt & Link đặt', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('create-order');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile header */}
      <header className="lg:hidden bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded hover:bg-blue-800 transition-colors"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="font-bold text-sm">Thiên Kim Sports</span>
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
      <aside className="hidden lg:flex flex-col w-64 bg-blue-900 text-white min-h-screen sticky top-0">
        <div className="px-5 py-6 border-b border-blue-800">
          <h1 className="font-bold text-lg leading-tight">Thiên Kim Sports</h1>
          <p className="text-blue-300 text-xs mt-1">Quản lý bán hàng & Kho</p>
        </div>
        <nav className="flex-1 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'bg-blue-800 text-white'
                    : 'text-blue-200 hover:bg-blue-800/50 hover:text-white'
                }`}
              >
                {activeTab === tab.id && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
                )}
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-blue-800 text-xs text-blue-300">
          <p className="font-medium text-blue-200">Công ty TNHH</p>
          <p>Thể Thao Thiên Kim</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {activeTab === 'create-order' && <CreateOrder />}
          {activeTab === 'orders' && <OrdersList />}
          {activeTab === 'consolidation' && <DailyConsolidation />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'finance' && <Finance />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
