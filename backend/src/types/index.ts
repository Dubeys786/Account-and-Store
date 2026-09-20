import { Request } from 'express';
import { UserRole } from '@prisma/client';

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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  jobTitle?: string | null;
  workspace?: string | null;
  roles: string[];
  permissions: string[];
  accessibleWorkspaces: AccessibleWorkspaces;
  profile?: UserProfile;
  phone?: string | null;
  storeIds: string[];
  defaultStoreId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      activeStoreId?: string;
    }
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
