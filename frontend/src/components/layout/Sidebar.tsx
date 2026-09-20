import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Shield,
  LogOut,
  Building2,
  X,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

interface NavItemConfig {
  name: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  roles?: string[];
}

interface NavSectionConfig {
  title: string;
  workspace?: 'store' | 'accounts' | 'admin';
  permission?: string;
  roles?: string[];
  items: NavItemConfig[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { user, logout, hasPermission, hasRole, accessibleWorkspaces } = useAuth();
  const { activeStore } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const userRolesDisplay = user?.roles?.length ? user.roles.join(', ') : user?.role || 'User';
  const hasMultipleWorkspaces =
    (accessibleWorkspaces.store && accessibleWorkspaces.accounts) || accessibleWorkspaces.admin;

  const navSections: NavSectionConfig[] = [
    {
      title: 'OVERVIEW',
      items: [
        ...(accessibleWorkspaces.store
          ? [
              {
                name: 'Store Dashboard',
                path: '/dashboard',
                icon: LayoutDashboard,
                permission: 'store.view',
              },
            ]
          : []),
        ...(accessibleWorkspaces.accounts
          ? [
              {
                name: 'Accounts Dashboard',
                path: '/accounts/dashboard',
                icon: PieChart,
                permission: 'accounts.view',
              },
            ]
          : []),
      ],
    },
    {
      title: 'MASTER DATA',
      workspace: 'store',
      items: [
        { name: 'Item Master', path: '/store/items', icon: Package, permission: 'item.view' },
        { name: 'PO Master', path: '/store/purchase-orders', icon: FileText, permission: 'po.view' },
      ],
    },
    {
      title: 'TRANSACTIONS',
      workspace: 'store',
      items: [
        {
          name: 'Material Inward',
          path: '/store/material-inwards',
          icon: ArrowDownToLine,
          permission: 'material_inward.view',
        },
      ],
    },
    {
      title: 'INVENTORY',
      workspace: 'store',
      items: [
        { name: 'Stock Register', path: '/store/stock-register', icon: Layers, permission: 'stock.view' },
        { name: 'Issue / Return', path: '/store/issue-return', icon: ArrowLeftRight, permission: 'stock.issue' },
        { name: 'Store Reports', path: '/store/reports', icon: BarChart3, permission: 'store_reports.view' },
      ],
    },
    {
      title: 'ACCOUNTS & FINANCE',
      workspace: 'accounts',
      items: [
        { name: 'Party Master', path: '/accounts/parties', icon: Users, permission: 'party.view' },
        { name: 'Purchase Accounts', path: '/accounts/purchases', icon: ShoppingBag, permission: 'purchase.view' },
        { name: 'Party Ledger', path: '/accounts/ledger', icon: BookOpen, permission: 'ledger.view' },
        { name: 'Receivables', path: '/accounts/receivables', icon: ArrowDownRight, permission: 'receivables.view' },
        { name: 'Payables', path: '/accounts/payables', icon: ArrowUpRight, permission: 'payables.view' },
        { name: 'Payments', path: '/accounts/payments', icon: CreditCard, permission: 'payment.view' },
        { name: 'Receipts', path: '/accounts/receipts', icon: Receipt, permission: 'receipt.view' },
        { name: 'Expenses', path: '/accounts/expenses', icon: Wallet, permission: 'expense.view' },
        { name: 'Income', path: '/accounts/income', icon: TrendingUp, permission: 'income.view' },
        { name: 'Day Book', path: '/accounts/day-book', icon: Calendar, permission: 'day_book.view' },
        { name: 'Cash Book', path: '/accounts/cash-book', icon: DollarSign, permission: 'cash_book.view' },
        { name: 'Bank Book', path: '/accounts/bank-book', icon: Building, permission: 'bank_book.view' },
        { name: 'Accounts Reports', path: '/accounts/reports', icon: BarChart3, permission: 'accounting_reports.view' },
      ],
    },
    {
      title: 'ADMINISTRATION',
      workspace: 'admin',
      roles: ['ADMIN'],
      items: [
        { name: 'Users & Access', path: '/admin/users', icon: Shield, permission: 'users.view' },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-30 w-64 bg-[#0b132a] text-slate-300 flex flex-col shrink-0 h-screen select-none border-r border-slate-800 shadow-xl transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-[#080e21]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-600/30">
              S
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-wider flex items-center gap-1.5">
                STOCKLEDGER
              </span>
              <span className="text-[10px] font-medium text-slate-400">Store • Inventory • Accounts</span>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Store Indicator */}
        {activeStore && accessibleWorkspaces.store && (
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

        {/* Switch Workspace Quick Button (for multi-domain users) */}
        {hasMultipleWorkspaces && (
          <div className="px-3 pt-3">
            <button
              onClick={() => navigate('/workspace')}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                <span>Switch Workspace</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">⌘W</span>
            </button>
          </div>
        )}

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          {navSections.map((section) => {
            // Check section authorization
            if (section.workspace && !accessibleWorkspaces[section.workspace]) {
              return null;
            }
            if (section.roles && !hasRole(section.roles)) {
              return null;
            }
            if (section.permission && !hasPermission(section.permission)) {
              return null;
            }

            const visibleItems = section.items.filter((item) => {
              if (item.roles && !hasRole(item.roles)) return false;
              if (item.permission && !hasPermission(item.permission)) return false;
              return true;
            });

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
                      (item.path !== '/dashboard' &&
                        item.path !== '/accounts/dashboard' &&
                        location.pathname.startsWith(item.path));

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onCloseMobile}
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
                  <Shield className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                  <span className="text-[10px] font-medium text-slate-400 truncate" title={userRolesDisplay}>
                    {userRolesDisplay}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
