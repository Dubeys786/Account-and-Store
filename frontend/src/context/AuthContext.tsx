import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Store, UserRole } from '../types';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  stores: Store[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('prozen_token'));
  const [stores, setStores] = useState<Store[]>(() => {
    const cached = localStorage.getItem('prozen_stores');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const savedToken = localStorage.getItem('prozen_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await authService.getMe();
        if (res.success && res.data) {
          setUser(res.data.user);
          setStores(res.data.stores);
          localStorage.setItem('prozen_user', JSON.stringify(res.data.user));
          localStorage.setItem('prozen_stores', JSON.stringify(res.data.stores));

          const activeStoreId = localStorage.getItem('prozen_active_store_id');
          if (!activeStoreId && res.data.user.defaultStoreId) {
            localStorage.setItem('prozen_active_store_id', res.data.user.defaultStoreId);
          }
        } else {
          // Token invalid
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
        setStores(res.data.stores);

        localStorage.setItem('prozen_token', res.data.token);
        localStorage.setItem('prozen_user', JSON.stringify(res.data.user));
        localStorage.setItem('prozen_stores', JSON.stringify(res.data.stores));

        if (res.data.user.defaultStoreId) {
          localStorage.setItem('prozen_active_store_id', res.data.user.defaultStoreId);
        } else if (res.data.stores[0]?.id) {
          localStorage.setItem('prozen_active_store_id', res.data.stores[0].id);
        }

        return { success: true };
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
