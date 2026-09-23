/**
 * Resolves the API Base URL cleanly handling:
 * - VITE_API_BASE_URL and VITE_API_URL
 * - Trailing slashes
 * - Subpaths (/api, /api/v1)
 * - Dev proxy fallback vs production
 */
export function getApiBaseUrl(): string {
  const envUrl =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    '';

  if (envUrl && typeof envUrl === 'string') {
    const cleaned = envUrl.trim().replace(/\/+$/, '');
    if (cleaned) {
      if (cleaned.endsWith('/api/v1') || cleaned.endsWith('/api')) {
        return cleaned;
      }
      return `${cleaned}/api/v1`;
    }
  }

  // Fallback for local Vite dev proxy or same-domain deployment
  return '/api/v1';
}

/**
 * Builds the normalized target API URL preventing duplicate /api/api or /api/v1/api/v1 paths.
 */
export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Prevent duplicate /api/v1 prefixes
  if (baseUrl.endsWith('/api/v1') && cleanEndpoint.startsWith('/api/v1/')) {
    return `${baseUrl.slice(0, -7)}${cleanEndpoint}`;
  }
  // Prevent duplicate /api/v1 and /api mismatch
  if (baseUrl.endsWith('/api/v1') && cleanEndpoint.startsWith('/api/')) {
    return `${baseUrl.slice(0, -7)}${cleanEndpoint}`;
  }
  // Prevent duplicate /api prefixes
  if (baseUrl.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    return `${baseUrl.slice(0, -4)}${cleanEndpoint}`;
  }

  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Maps HTTP response statuses to user-friendly messages without exposing internal URLs or stack traces.
 */
function formatErrorMessage(status: number, data: any, endpoint: string): string {
  if (
    data?.message &&
    typeof data.message === 'string' &&
    !data.message.includes('Cannot POST') &&
    !data.message.includes('Cannot GET') &&
    !data.message.includes('<!DOCTYPE')
  ) {
    return data.message;
  }

  const isAuthRoute = endpoint.includes('/auth/');

  switch (status) {
    case 400:
    case 422:
      return 'Invalid request format. Please check your credentials and try again.';
    case 401:
      return 'Invalid email or password.';
    case 403:
      return 'Account access is restricted or unauthorized. Please contact your system administrator.';
    case 404:
      return isAuthRoute
        ? 'Unable to connect to the authentication service. Please try again.'
        : 'The requested resource was not found.';
    case 429:
      return 'Too many login attempts. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Authentication service is temporarily unavailable.';
    default:
      return `Service error (${status}). Please try again later.`;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: any; meta?: any; summary?: any; [key: string]: any }> {
  const token = localStorage.getItem('stockledger_token') || localStorage.getItem('prozen_token');
  const activeStoreId = localStorage.getItem('stockledger_active_store_id') || localStorage.getItem('prozen_active_store_id');

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

  const url = buildApiUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('stockledger_token');
        localStorage.removeItem('stockledger_user');
        localStorage.removeItem('stockledger_stores');
        localStorage.removeItem('stockledger_active_store_id');
        localStorage.removeItem('prozen_token');
        localStorage.removeItem('prozen_user');
        window.location.href = '/login';
      }
      return {
        success: false,
        message: formatErrorMessage(response.status, data, endpoint),
        error: data?.error,
      };
    }

    return data || { success: true };
  } catch (error: any) {
    const isAuthRoute = endpoint.includes('/auth/');
    return {
      success: false,
      message: isAuthRoute
        ? 'Authentication service is temporarily unavailable.'
        : error.message || 'Network error occurred. Please check your server connection.',
    };
  }
}

export default apiRequest;
