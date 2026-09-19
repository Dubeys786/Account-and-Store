const API_BASE_URL = '/api/v1';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: any }> {
  const token = localStorage.getItem('prozen_token');
  const activeStoreId = localStorage.getItem('prozen_active_store_id');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeStoreId) {
    headers['x-store-id'] = activeStoreId;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('prozen_token');
        localStorage.removeItem('prozen_user');
        window.location.href = '/login';
      }
      return {
        success: false,
        message: data?.message || `Request failed with status ${response.status}`,
        error: data?.error,
      };
    }

    return data || { success: true };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Network error occurred. Please check your server connection.',
    };
  }
}

export default apiRequest;
