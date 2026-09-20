export type UserRole = 'ADMIN' | 'STORE_MANAGER' | 'STORE_USER' | 'ACCOUNT_MANAGER' | 'ACCOUNT_USER' | 'VIEWER' | string;

export interface AccessibleWorkspaces {
  store: boolean;
  accounts: boolean;
  admin: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
  accessibleWorkspaces: AccessibleWorkspaces;
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
  roles?: string[];
  permission?: string;
  permissions?: string[];
  workspace?: 'store' | 'accounts' | 'admin';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  legacyRole: string;
  roles: string[];
  stores: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions: string[];
}

export interface PermissionRecord {
  id: string;
  name: string;
  module: string;
  description: string;
}
