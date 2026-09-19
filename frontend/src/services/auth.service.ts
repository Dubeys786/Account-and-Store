import apiRequest from './api';
import { User, Store } from '../types';

export interface LoginResponse {
  token: string;
  user: User;
  stores: Store[];
}

export const authService = {
  async login(email: string, password: string) {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getMe() {
    return apiRequest<{ user: User; stores: Store[] }>('/auth/me');
  },

  async logout() {
    await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem('prozen_token');
    localStorage.removeItem('prozen_user');
    localStorage.removeItem('prozen_stores');
    localStorage.removeItem('prozen_active_store_id');
  },
};
