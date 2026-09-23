/**
 * Resolves the API Base URL cleanly handling:
 * - VITE_API_BASE_URL and VITE_API_URL
 * - Trailing slashes
 * - Subpaths (/api, /api/v1)
 * - Dev proxy fallback vs production
 */
export function getApiBaseUrl(): string {
  // Support optional runtime global configuration
  const runtimeUrl = typeof window !== 'undefined' ? (window as any).__STOCKLEDGER_API_URL__ : undefined;

  const rawEnvUrl =
    runtimeUrl ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    '';

  if (rawEnvUrl && typeof rawEnvUrl === 'string') {
    const cleaned = rawEnvUrl.trim().replace(/\/+$/, '');
    if (cleaned) {
      // In remote environments (e.g. Vercel deployment), do not use baked-in localhost/127.0.0.1
      if (
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1' &&
        (cleaned.includes('localhost') || cleaned.includes('127.0.0.1'))
      ) {
        return '/api/v1';
      }

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
  const isAuthRoute = endpoint.includes('/auth/');

  if (isAuthRoute) {
    switch (status) {
      case 400:
      case 422:
        return data?.message && typeof data.message === 'string' && !data.message.includes('<!DOCTYPE')
          ? data.message
          : 'Invalid request format. Please check your credentials and try again.';
      case 401:
        return 'Invalid email or password.';
      case 403:
        return 'You are not authorized to access this workspace.';
      case 404:
        return 'Authentication endpoint was not found. Please check the API configuration.';
      case 429:
        return 'Too many login attempts. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Authentication server encountered an error.';
      default:
        return data?.message && typeof data.message === 'string' && !data.message.includes('<!DOCTYPE')
          ? data.message
          : `Authentication failed (${status}). Please try again later.`;
    }
  }

  if (
    data?.message &&
    typeof data.message === 'string' &&
    !data.message.includes('Cannot POST') &&
    !data.message.includes('Cannot GET') &&
    !data.message.includes('<!DOCTYPE')
  ) {
    return data.message;
  }

  switch (status) {
    case 400:
    case 422:
      return 'Invalid request format. Please check your input and try again.';
    case 401:
      return 'Session expired or unauthorized. Please sign in again.';
    case 403:
      return 'Access is restricted or unauthorized.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server encountered an error. Please try again later.';
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
        ? 'Unable to connect to the authentication service.'
        : error.message || 'Network error occurred. Please check your server connection.',
    };
  }
}

export default apiRequest;
