import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  Store as StoreIcon,
  ShieldCheck,
  User as UserIcon,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { NotificationDropdown } from '../notifications/NotificationDropdown';

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileMenu }) => {
  const { user, accessibleWorkspaces, logout } = useAuth();
  const { activeStore, setActiveStore, availableStores } = useStore();
  const location = useLocation();

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdownOpen]);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs w-full">
      {/* Primary Header Row */}
      <div className="h-16 px-3 sm:px-6 flex items-center justify-between gap-2 max-w-full">
        {/* Left Side: Hamburger & Brand / Desktop Search */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Hamburger Menu Button (Mobile / Tablet) */}
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Brand Title */}
          <span className="lg:hidden font-bold text-sm sm:text-base text-slate-900 tracking-tight truncate">
            STOCKLEDGER
          </span>

          {/* Desktop Search Bar */}
          <div className="hidden sm:block relative w-48 md:w-64 lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items, POs, vouchers..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile Search Toggle Icon */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="sm:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Search"
            aria-label="Toggle mobile search"
          >
            {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* Workspace Switcher (for multi-workspace users on tablet/desktop) */}
          {accessibleWorkspaces.store && accessibleWorkspaces.accounts && (
            <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <Link
                to="/store"
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  !location.pathname.startsWith('/accounts')
                    ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Store
              </Link>
              <Link
                to="/accounts"
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  location.pathname.startsWith('/accounts')
                    ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Accounts
              </Link>
            </div>
          )}

          {/* Store Switcher (Compact on mobile) */}
          {availableStores.length > 0 && (
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 sm:px-2.5 py-1.5 max-w-[105px] sm:max-w-[180px] md:max-w-[220px]">
              <StoreIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={activeStore?.id || ''}
                onChange={(e) => {
                  const selected = availableStores.find((s) => s.id === e.target.value);
                  if (selected) setActiveStore(selected);
                }}
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer truncate w-full"
                title={activeStore ? `${activeStore.name} (${activeStore.code})` : 'Select Store'}
              >
                {availableStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notifications Dropdown */}
          <NotificationDropdown />

          <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

          {/* User Badge with Mobile Popover */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 transition-colors text-left"
              aria-label="User Profile Menu"
            >
              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
                  {user?.name}
                </span>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span
                    className="text-[10px] font-semibold text-slate-500 truncate max-w-[140px]"
                    title={user?.jobTitle || user?.roles?.join(', ') || user?.role}
                  >
                    {user?.jobTitle || user?.roles?.join(', ') || user?.role}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* User Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                    {user?.jobTitle || user?.roles?.join(', ') || user?.role}
                  </span>
                </div>

                {accessibleWorkspaces.store && accessibleWorkspaces.accounts && (
                  <div className="px-3 py-1.5 md:hidden border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Workspace</p>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/store"
                        onClick={() => setUserDropdownOpen(false)}
                        className={`flex-1 text-center py-1 text-xs rounded font-semibold ${
                          !location.pathname.startsWith('/accounts')
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Store
                      </Link>
                      <Link
                        to="/accounts"
                        onClick={() => setUserDropdownOpen(false)}
                        className={`flex-1 text-center py-1 text-xs rounded font-semibold ${
                          location.pathname.startsWith('/accounts')
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Accounts
                      </Link>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Expandable Bar */}
      {mobileSearchOpen && (
        <div className="sm:hidden px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search items, POs, vouchers..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setMobileSearchOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};

export default Topbar;
