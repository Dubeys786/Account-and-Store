import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, LayoutGrid } from 'lucide-react';
import { Button } from '../common/Button';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  requiredPermission?: string;
  requiredPermissions?: string[];
  workspace?: 'store' | 'accounts';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requiredPermission,
  requiredPermissions,
  workspace,
}) => {
  const { isAuthenticated, isLoading, user, hasRole, hasPermission, hasAnyPermission, accessibleWorkspaces } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-slate-500">Loading STOCKLEDGER Workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If user has zero access to any workspace, send to /unassigned
  const hasAnyWorkspace =
    accessibleWorkspaces.store || accessibleWorkspaces.accounts;

  if (!hasAnyWorkspace && window.location.pathname !== '/unassigned') {
    return <Navigate to="/unassigned" replace />;
  }

  // Check workspace authorization
  if (workspace && !accessibleWorkspaces[workspace]) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">403 — Workspace Access Forbidden</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          You do not have access to the <span className="font-semibold text-slate-800 capitalize">{workspace}</span> workspace.
          Please contact your system administrator to assign the necessary roles.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} icon={<ArrowLeft className="w-4 h-4" />}>
            Go Back
          </Button>
          <Button variant="primary" onClick={() => navigate('/workspace')} icon={<LayoutGrid className="w-4 h-4" />}>
            Switch Workspace
          </Button>
        </div>
      </div>
    );
  }

  // Check role authorization
  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">403 — Access Denied</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Your assigned role(s) (<span className="font-semibold text-slate-800">{user.roles?.join(', ') || user.role}</span>) do not have authorization to view this module.
          Required role: <span className="font-semibold text-slate-800">{allowedRoles.join(' or ')}</span>.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} icon={<ArrowLeft className="w-4 h-4" />}>
            Go Back
          </Button>
          <Button variant="primary" onClick={() => navigate('/workspace')} icon={<LayoutGrid className="w-4 h-4" />}>
            Workspace Selector
          </Button>
        </div>
      </div>
    );
  }

  // Check permission authorization
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">403 — Insufficient Permissions</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          This operation requires permission <code className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-800">{requiredPermission}</code>, which is not granted to your account.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)} icon={<ArrowLeft className="w-4 h-4" />}>
          Go Back
        </Button>
      </div>
    );
  }

  if (requiredPermissions && !hasAnyPermission(requiredPermissions)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">403 — Insufficient Permissions</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          You lack the required permissions to access this screen.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)} icon={<ArrowLeft className="w-4 h-4" />}>
          Go Back
        </Button>
      </div>
    );
  }

  return <Outlet />;
};
