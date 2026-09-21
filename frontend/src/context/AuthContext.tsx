import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Store, AccessibleWorkspaces } from '../types';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  stores: Store[];
  isAuthenticated: boolean;
  isLoading: boolean;
  accessibleWorkspaces: AccessibleWorkspaces;
  hasRole: (role: string | string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('stockledger_token') || localStorage.getItem('prozen_token')
  );
  const [stores, setStores] = useState<Store[]>(() => {
    const cached = localStorage.getItem('stockledger_stores') || localStorage.getItem('prozen_stores');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const savedToken =
        localStorage.getItem('stockledger_token') || localStorage.getItem('prozen_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await authService.getMe();
        if (res.success && res.data) {
          setUser(res.data.user);
          setStores(res.data.stores);

          // Store in stockledger_* keys and remove deprecated prozen_* keys
          localStorage.setItem('stockledger_token', savedToken);
          localStorage.setItem('stockledger_user', JSON.stringify(res.data.user));
          localStorage.setItem('stockledger_stores', JSON.stringify(res.data.stores));
          localStorage.removeItem('prozen_user');
          localStorage.removeItem('prozen_stores');

          const activeStoreId =
            localStorage.getItem('stockledger_active_store_id') ||
            localStorage.getItem('prozen_active_store_id');
          if (!activeStoreId && res.data.user.defaultStoreId) {
            localStorage.setItem('stockledger_active_store_id', res.data.user.defaultStoreId);
          } else if (activeStoreId) {
            localStorage.setItem('stockledger_active_store_id', activeStoreId);
          }
          localStorage.removeItem('prozen_active_store_id');
        } else {
          // Token invalid
          localStorage.removeItem('stockledger_token');
          localStorage.removeItem('stockledger_user');
          localStorage.removeItem('stockledger_stores');
          localStorage.removeItem('stockledger_active_store_id');
          localStorage.removeItem('prozen_token');
          localStorage.removeItem('prozen_user');
          setToken(null);
          setUser(null);
        }
      } catch {
        // Ignore network errors on init
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const userPerms = user?.permissions || [];

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    const rolesToCheck = Array.isArray(role) ? role : [role];
    return rolesToCheck.some((r) => userRoles.includes(r));
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return userPerms.includes(permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false;
    return permissions.some((p) => userPerms.includes(p));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false;
    return permissions.every((p) => userPerms.includes(p));
  };

  const accessibleWorkspaces: AccessibleWorkspaces = user?.accessibleWorkspaces || {
    store: userRoles.some((r) => ['STORE_INCHARGE', 'STORE_MANAGER', 'STORE_USER', 'ACCOUNT_AND_STORE_INCHARGE'].includes(r)),
    accounts: userRoles.some((r) => ['ACCOUNT_AND_STORE_INCHARGE', 'ACCOUNT_MANAGER', 'ACCOUNT_USER'].includes(r)),
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
        setStores(res.data.stores);

        localStorage.setItem('stockledger_token', res.data.token);
        localStorage.setItem('stockledger_user', JSON.stringify(res.data.user));
        localStorage.setItem('stockledger_stores', JSON.stringify(res.data.stores));

        // Clean deprecated keys
        localStorage.removeItem('prozen_token');
        localStorage.removeItem('prozen_user');
        localStorage.removeItem('prozen_stores');

        if (res.data.user.defaultStoreId) {
          localStorage.setItem('stockledger_active_store_id', res.data.user.defaultStoreId);
        } else if (res.data.stores[0]?.id) {
          localStorage.setItem('stockledger_active_store_id', res.data.stores[0].id);
        }

        return { success: true, user: res.data.user };
      }
      return { success: false, message: res.message || 'Login failed.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error occurred.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setToken(null);
    setUser(null);
    setStores([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        stores,
        isAuthenticated: !!token && !!user,
        isLoading,
        accessibleWorkspaces,
        hasRole,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
