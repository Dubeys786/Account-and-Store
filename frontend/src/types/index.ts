export type UserRole = 'ADMIN' | 'STORE_USER' | 'ACCOUNT_USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  storeIds: string[];
  defaultStoreId?: string | null;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  location?: string | null;
  isDefault?: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  stores: Store[];
}

export interface NavItem {
  name: string;
  path: string;
  icon: string;
  badge?: string;
  roles?: UserRole[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
