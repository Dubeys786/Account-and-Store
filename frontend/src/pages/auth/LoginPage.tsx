import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Shield, Package, Calculator, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@prozen.com');
  const [password, setPassword] = useState('Prozen@123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const loginEmail = customEmail || email;
    const loginPassword = customPass || password;

    const result = await login(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message || 'Authentication failed. Please check credentials.');
    }
  };

  const selectDemoRole = (role: UserRole) => {
    let demoEmail = 'admin@prozen.com';
    if (role === 'STORE_USER') demoEmail = 'store@prozen.com';
    if (role === 'ACCOUNT_USER') demoEmail = 'account@prozen.com';

    setEmail(demoEmail);
    setPassword('Prozen@123');
    handleSignIn(undefined, demoEmail, 'Prozen@123');
  };

  return (
    <div className="min-h-screen bg-[#070d1e] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-[#0e172e] border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md">
          {/* Header */}
          <div className="text-left mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">Sign In to Workspace</h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter your credentials or choose a pre-configured role below
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => handleSignIn(e)} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                EMAIL ADDRESS
              </label>
              <div className="relative rounded-xl border border-slate-700/80 bg-[#141f3d] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="name@prozen.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                PASSWORD
              </label>
              <div className="relative rounded-xl border border-slate-700/80 bg-[#141f3d] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Switch Demo Roles */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="text-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                QUICK SWITCH DEMO ROLES
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Admin Card */}
              <button
                type="button"
                onClick={() => selectDemoRole('ADMIN')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  email === 'admin@prozen.com'
                    ? 'border-blue-500/80 bg-blue-600/15 ring-1 ring-blue-500/50'
                    : 'border-slate-800 bg-[#121c38] hover:border-slate-700 hover:bg-[#152244]'
                }`}
              >
                <Shield className="w-5 h-5 text-blue-400 mb-1.5" />
                <span className="text-xs font-bold text-white">Admin</span>
                <span className="text-[10px] text-slate-400">Full Access</span>
              </button>

              {/* Store User Card */}
              <button
                type="button"
                onClick={() => selectDemoRole('STORE_USER')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  email === 'store@prozen.com'
                    ? 'border-emerald-500/80 bg-emerald-600/15 ring-1 ring-emerald-500/50'
                    : 'border-slate-800 bg-[#121c38] hover:border-slate-700 hover:bg-[#152244]'
                }`}
              >
                <Package className="w-5 h-5 text-emerald-400 mb-1.5" />
                <span className="text-xs font-bold text-white">Store User</span>
                <span className="text-[10px] text-slate-400">Inventory</span>
              </button>

              {/* Account User Card */}
              <button
                type="button"
                onClick={() => selectDemoRole('ACCOUNT_USER')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  email === 'account@prozen.com'
                    ? 'border-purple-500/80 bg-purple-600/15 ring-1 ring-purple-500/50'
                    : 'border-slate-800 bg-[#121c38] hover:border-slate-700 hover:bg-[#152244]'
                }`}
              >
                <Calculator className="w-5 h-5 text-purple-400 mb-1.5" />
                <span className="text-xs font-bold text-white">Account User</span>
                <span className="text-[10px] text-slate-400">Accounting</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-600 mt-6 font-medium">
          PROZEN Enterprise v1.0.0 • Secure Multi-Tenant Architecture
        </p>
      </div>
    </div>
  );
};
