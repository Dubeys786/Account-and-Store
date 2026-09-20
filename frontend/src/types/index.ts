export type UserRole =
  | 'STORE_INCHARGE'
  | 'ACCOUNT_AND_STORE_INCHARGE'
  | 'STORE_USER'
  | 'ACCOUNT_USER'
  | string;

export interface AccessibleWorkspaces {
  store: boolean;
  accounts: boolean;
}

export interface UserProfile {
  full_name: string;
  email: string;
  job_title: string;
  workspace: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  jobTitle?: string | null;
  workspace?: string | null;
  role: string;
  roles: string[];
  permissions: string[];
  accessibleWorkspaces: AccessibleWorkspaces;
  profile?: UserProfile;
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
  workspace?: 'store' | 'accounts';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
