import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Search, Store as StoreIcon, ShieldCheck, User as UserIcon, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileMenu }) => {
  const { user } = useAuth();
  const { activeStore, setActiveStore, availableStores } = useStore();
  const location = useLocation();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu Button (Mobile / Tablet) */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar */}
        <div className="relative w-48 sm:w-72 md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, POs, parties, vouchers..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Workspace Switcher (for dual-role ADMIN users) */}
        {user?.role === 'ADMIN' && (
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <Link
              to="/dashboard"
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                !location.pathname.startsWith('/accounts')
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Store Hub
            </Link>
            <Link
              to="/accounts/dashboard"
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                location.pathname.startsWith('/accounts')
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accounts Hub
            </Link>
          </div>
        )}
        {/* Store Switcher */}
        {availableStores.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={activeStore?.id || ''}
              onChange={(e) => {
                const selected = availableStores.find((s) => s.id === e.target.value);
                if (selected) setActiveStore(selected);
              }}
              className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              {availableStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notifications */}
        <button
          title="Notifications"
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white"></span>
        </button>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* User Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
            {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</span>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-semibold text-slate-500">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
