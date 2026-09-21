import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  CreditCard,
  Shield,
  Layers,
  ArrowRight,
  LogOut,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const WorkspaceSelectorPage: React.FC = () => {
  const { user, accessibleWorkspaces, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userRolesDisplay = user?.roles?.length ? user.roles.join(', ') : user?.role || 'User';

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 flex flex-col justify-between p-4 sm:p-10 relative select-none">
      {/* Background glow effects */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-600/30">
            S
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wider flex items-center gap-2">
              STOCKLEDGER
            </h1>
            <p className="text-[11px] font-medium text-slate-400">Enterprise Unified Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-white">{user?.name}</span>
            <span className="text-xs text-blue-400 font-mono">{userRolesDisplay}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-900/80 rounded-xl border border-slate-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Workspace Selection Main Container */}
      <main className="relative z-10 max-w-5xl w-full mx-auto my-auto py-10">
        <div className="text-center max-w-xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800 text-blue-400 text-xs font-semibold mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Domain Enterprise Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Choose Your Workspace
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Select an operational domain to continue. Your access rights and features are configured dynamically by the RBAC security engine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Card 1: Store & Inventory */}
          <div
            onClick={() => accessibleWorkspaces.store && navigate('/store')}
            className={`group relative rounded-2xl p-7 flex flex-col justify-between transition-all duration-200 border ${
              accessibleWorkspaces.store
                ? 'bg-[#0e172e] hover:bg-[#14203f] border-slate-800 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-600/10 cursor-pointer'
                : 'bg-slate-950/50 border-slate-900 opacity-60 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    accessibleWorkspaces.store
                      ? 'bg-blue-600/20 text-blue-400 group-hover:scale-105 transition-transform'
                      : 'bg-slate-900 text-slate-600'
                  }`}
                >
                  <Package className="w-6 h-6" />
                </div>
                {accessibleWorkspaces.store ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" /> Authorized
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                Store & Inventory
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Material Inwards (GRN), Purchase Orders, Item Catalog Master, Multi-Store Stock Ledger, and Valuation Reports.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Warehouse Hub</span>
              {accessibleWorkspaces.store ? (
                <span className="text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Launch Workspace <ArrowRight className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="text-slate-600">Access not assigned</span>
              )}
            </div>
          </div>

          {/* Card 2: Accounts & Finance */}
          <div
            onClick={() => accessibleWorkspaces.accounts && navigate('/accounts')}
            className={`group relative rounded-2xl p-7 flex flex-col justify-between transition-all duration-200 border ${
              accessibleWorkspaces.accounts
                ? 'bg-[#0e172e] hover:bg-[#14203f] border-slate-800 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-600/10 cursor-pointer'
                : 'bg-slate-950/50 border-slate-900 opacity-60 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    accessibleWorkspaces.accounts
                      ? 'bg-emerald-600/20 text-emerald-400 group-hover:scale-105 transition-transform'
                      : 'bg-slate-900 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-6 h-6" />
                </div>
                {accessibleWorkspaces.accounts ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" /> Authorized
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                Accounts & Finance
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Party Master, Purchase Accounting (PO & direct), Party Ledgers, Day Book, Cash/Bank Books, and Cash Flow.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Financial Hub</span>
              {accessibleWorkspaces.accounts ? (
                <span className="text-emerald-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Launch Workspace <ArrowRight className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="text-slate-600">Access not assigned</span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center pt-6 text-xs text-slate-600">
        STOCKLEDGER Enterprise Operating System • Role-Based Access Control Active
      </footer>
    </div>
  );
};
