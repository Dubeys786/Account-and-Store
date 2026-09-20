import apiRequest from './api';
import { AdminUserRecord, RoleRecord, PermissionRecord } from '../types';

export interface CreateUserData {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  roles: string[];
  storeIds: string[];
  defaultStoreId?: string;
}

export const adminService = {
  async getUsers() {
    return apiRequest<AdminUserRecord[]>('/admin/users');
  },

  async getUserById(id: string) {
    return apiRequest<AdminUserRecord>(`/admin/users/${id}`);
  },

  async createUser(data: CreateUserData) {
    return apiRequest<AdminUserRecord>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUserRoles(id: string, roles: string[]) {
    return apiRequest<AdminUserRecord>(`/admin/users/${id}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles }),
    });
  },

  async updateUserStores(id: string, storeIds: string[], defaultStoreId?: string) {
    return apiRequest<AdminUserRecord>(`/admin/users/${id}/stores`, {
      method: 'PUT',
      body: JSON.stringify({ storeIds, defaultStoreId }),
    });
  },

  async toggleUserStatus(id: string, isActive: boolean) {
    return apiRequest<{ id: string; email: string; isActive: boolean }>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  async getRoles() {
    return apiRequest<RoleRecord[]>('/admin/roles');
  },

  async getPermissions() {
    return apiRequest<{ all: PermissionRecord[]; grouped: Record<string, PermissionRecord[]> }>(
      '/admin/permissions'
    );
  },

  async getAuditLogs(limit = 50, offset = 0) {
    return apiRequest<{ logs: any[]; total: number; limit: number; offset: number }>(
      `/admin/audit-logs?limit=${limit}&offset=${offset}`
    );
  },
};
