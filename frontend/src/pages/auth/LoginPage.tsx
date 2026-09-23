import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Layers, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success && result.user) {
      const { accessibleWorkspaces } = result.user;
      const hasStore = accessibleWorkspaces?.store ?? false;
      const hasAccounts = accessibleWorkspaces?.accounts ?? false;

      if (!hasStore && !hasAccounts) {
        navigate('/unassigned');
      } else if (hasAccounts) {
        // Accounts landing destination for accounts incharge
        navigate('/accounts');
      } else if (hasStore) {
        // Store landing destination for store incharge
        navigate('/store');
      } else {
        navigate('/unassigned');
      }
    } else {
      setError(result.message || 'Authentication failed. Please check credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1e] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-[#0e172e] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-8 backdrop-blur-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-3 text-blue-400">
              <Layers className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-wider">STOCKLEDGER</h1>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mt-1">
              Store • Inventory • Accounts
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Enter your credentials to access your enterprise workspace
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
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                EMAIL ADDRESS
              </label>
              <div className="relative rounded-xl border border-slate-700/80 bg-[#141f3d] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                PASSWORD
              </label>
              <div className="relative rounded-xl border border-slate-700/80 bg-[#141f3d] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  id="password-toggle-btn"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              id="sign-in-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-600 mt-6 font-medium">
          STOCKLEDGER Enterprise • Store, Inventory & Accounts
        </p>
      </div>
    </div>
  );
};
