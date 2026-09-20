import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldX, LogOut, RefreshCw, Mail, User as UserIcon } from 'lucide-react';

export const AccessNotAssignedPage: React.FC = () => {
  const { user, logout, accessibleWorkspaces } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Reload window to trigger AuthContext.loadUser()
    setTimeout(() => {
      window.location.href = '/workspace';
    }, 500);
  };

  // If user already has access, redirect them to workspace
  if (accessibleWorkspaces.store || accessibleWorkspaces.accounts || accessibleWorkspaces.admin) {
    navigate('/workspace');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative select-none">
      <div className="absolute top-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#0e172e] border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md text-center">
          {/* Warning Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 mb-5 text-amber-400">
            <ShieldX className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-wide">
            Access Not Assigned Yet
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Your STOCKLEDGER account is registered and active, but an administrator has not yet assigned any functional roles or store access to your profile.
          </p>

          {/* User Details Card */}
          <div className="mt-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-left space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-semibold text-white">{user?.name || 'User'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-mono">{user?.email}</span>
            </div>
          </div>

          {/* Call to action */}
          <p className="text-[11px] text-slate-500 mt-5">
            Please reach out to your system administrator or company manager to grant the required permissions for Store or Accounts modules.
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Checking permissions...' : 'Check For Updates'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-semibold text-xs transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6 font-medium">
          STOCKLEDGER Enterprise • Security & Access Control
        </p>
      </div>
    </div>
  );
};
