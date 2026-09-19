import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileText,
  ArrowDownToLine,
  Layers,
  ArrowLeftRight,
  PieChart,
  Users,
  ShoppingBag,
  BookOpen,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Receipt,
  Wallet,
  TrendingUp,
  Calendar,
  DollarSign,
  Building,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { UserRole } from '../../types';

interface NavItemConfig {
  name: string;
  path: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
  roles?: UserRole[];
}

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeStore } = useStore();
  const location = useLocation();

  const navSections: NavSectionConfig[] = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'MASTER DATA',
      roles: ['ADMIN', 'STORE_USER'],
      items: [
        { name: 'Item Master', path: '/store/items', icon: Package, roles: ['ADMIN', 'STORE_USER'] },
        { name: 'PO Master', path: '/store/purchase-orders', icon: FileText, roles: ['ADMIN', 'STORE_USER'] },
      ],
    },
    {
      title: 'TRANSACTIONS',
      roles: ['ADMIN', 'STORE_USER'],
      items: [
        { name: 'Material Inward', path: '/store/material-inwards', icon: ArrowDownToLine, roles: ['ADMIN', 'STORE_USER'] },
      ],
    },
    {
      title: 'INVENTORY',
      roles: ['ADMIN', 'STORE_USER'],
      items: [
        { name: 'Stock Register', path: '/store/stock-register', icon: Layers, roles: ['ADMIN', 'STORE_USER'] },
        { name: 'Issue / Return', path: '/store/issue-return', icon: ArrowLeftRight, roles: ['ADMIN', 'STORE_USER'] },
        { name: 'Store Reports', path: '/store/reports', icon: BarChart3, roles: ['ADMIN', 'STORE_USER'] },
      ],
    },
    {
      title: 'ACCOUNTS',
      roles: ['ADMIN', 'ACCOUNT_USER'],
      items: [
        { name: 'Accounts Dashboard', path: '/accounts/dashboard', icon: PieChart, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Party Master', path: '/accounts/parties', icon: Users, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Purchase Accounts', path: '/accounts/purchases', icon: ShoppingBag, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Party Ledger', path: '/accounts/ledger', icon: BookOpen, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Receivables', path: '/accounts/receivables', icon: ArrowDownRight, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Payables', path: '/accounts/payables', icon: ArrowUpRight, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Payments', path: '/accounts/payments', icon: CreditCard, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Receipts', path: '/accounts/receipts', icon: Receipt, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Expenses', path: '/accounts/expenses', icon: Wallet, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Income', path: '/accounts/income', icon: TrendingUp, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Day Book', path: '/accounts/day-book', icon: Calendar, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Cash Book', path: '/accounts/cash-book', icon: DollarSign, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Bank Book', path: '/accounts/bank-book', icon: Building, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Accounting Reports', path: '/accounts/reports', icon: BarChart3, roles: ['ADMIN', 'ACCOUNT_USER'] },
        { name: 'Account Settings', path: '/accounts/settings', icon: Settings, roles: ['ADMIN', 'ACCOUNT_USER'] },
      ],
    },
  ];

  const userRole = user?.role || 'STORE_USER';

  return (
    <aside className="w-64 bg-[#0b132a] text-slate-300 flex flex-col shrink-0 h-screen sticky top-0 select-none border-r border-slate-800 shadow-xl z-30">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80 bg-[#080e21]">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-600/30">
          P
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-white tracking-wider flex items-center gap-1.5">
            PROZEN
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
              ERP
            </span>
          </span>
          <span className="text-xs font-medium text-slate-400">Store & Accounts</span>
        </div>
      </div>

      {/* Active Store Indicator */}
      {activeStore && (
        <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-medium text-slate-300 truncate" title={activeStore.name}>
              {activeStore.name}
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
            {activeStore.code}
          </span>
        </div>
      )}

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {navSections.map((section) => {
          // Check section role authorization
          if (section.roles && !section.roles.includes(userRole)) {
            return null;
          }

          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(userRole)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <h4 className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {section.title}
              </h4>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-slate-800 bg-[#080e21]">
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
              <div className="flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-blue-400" />
                <span className="text-[10px] font-medium text-slate-400">
                  {user?.role === 'ADMIN'
                    ? 'Admin (Full)'
                    : user?.role === 'STORE_USER'
                    ? 'Store User'
                    : 'Account User'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
