/**
 * 统一API客户端 - 优化所有前端与服务端对接
 * - 自动注入 x-token
 * - 统一错误处理、401登出、network error toast
 * - 支持相对路径 (与Vite proxy和生产SPA一致)
 * - 类型安全，返回Promise
 */

// 无外部toast依赖，使用console和浏览器alert（可后续集成项目toast系统如ChatContext的toasts）

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface ApiError extends Error {
  status?: number;
  detail?: string;
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('user_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['x-token'] = token;
  }

  // 支持相对路径和绝对
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;

  const config: RequestInit = {
    credentials: 'include',
    ...options,
    headers,
  };

  try {
    const response = await fetch(fullUrl, config);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: response.statusText };
      }

      const error: ApiError = new Error(errorData.detail || `HTTP ${response.status}`);
      error.status = response.status;
      error.detail = errorData.detail;

      if (response.status === 401) {
        // 统一401处理：清除token并跳转登录（与现有页面逻辑一致）
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_info');
        window.location.href = '/login';
        console.error('登录已过期，请重新登录');
        alert('登录已过期，请重新登录'); // 可替换为项目toast系统
      } else if (response.status >= 500) {
        console.error('服务器错误，请稍后重试');
        alert('服务器错误，请稍后重试');
      } else {
        console.error(errorData.detail || '请求失败');
        alert(errorData.detail || '请求失败');
      }

      throw error;
    }

    // 对于非JSON响应（如图片上传），直接返回
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return response as any; // for blobs etc.
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message?.includes('fetch')) {
      // Network error - 统一处理，与报告中提到的不一致错误处理对齐
      const networkError = new Error('网络连接失败，请检查网络') as ApiError;
      console.error('网络错误:', err);
      alert('网络错误，请检查您的网络连接或稍后重试');
      throw networkError;
    }
    console.error('API请求异常:', err);
    throw err;
  }
}

// 便捷方法
export const api = {
  get: <T = any>(url: string, options: RequestInit = {}) =>
    apiFetch<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, data?: any, options: RequestInit = {}) =>
    apiFetch<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(url: string, data?: any, options: RequestInit = {}) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(url: string, options: RequestInit = {}) =>
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};

export default apiFetch;
