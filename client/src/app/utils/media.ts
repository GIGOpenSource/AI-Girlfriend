const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;

/**
 * 仅对跨域图片请求设置 crossOrigin；同源（经 Vite 代理后多为同源）不设置，避免无谓 CORS 与加载失败。
 */
export function imageCrossOriginForUrl(url: string): "anonymous" | undefined {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
    return undefined;
  }
  try {
    const resolved = /^https?:\/\//i.test(url)
      ? new URL(url)
      : new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost/");
    if (typeof window !== "undefined" && resolved.origin === window.location.origin) {
      return undefined;
    }
    return "anonymous";
  } catch {
    return undefined;
  }
}

/**
 * 统一处理后端返回的媒体 URL：
 * - 兼容相对路径（/data/images/... 或 data/images/...）
 * - 将 localhost 地址映射为当前站点，避免线上/手机端访问 localhost 失败
 */
export function normalizeMediaUrl(src?: string | null): string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;

  // 严格过滤所有异常/无效图片地址，防止前端展示错误
  // 覆盖场景：Vite dev server 源码路径 (/src/main.tsx?t=...)、临时占位 (picsum, x.ai, placeholder)、生成中标记、空值、JS/源码文件等
  if (
    !trimmed ||
    trimmed === '__GENERATING__' ||
    trimmed.includes('__GENERATING__') ||
    trimmed.includes('/src/') ||
    trimmed.includes('main.tsx') ||
    trimmed.includes('?t=') ||
    /\.(tsx?|jsx?|js|map|json|md|py|html|css|ts|log)$/i.test(trimmed) ||
    trimmed.includes('placeholder') ||
    (trimmed.includes('picsum.photos') && trimmed.length < 30) || // 过短的 picsum 可能不稳定
    trimmed.startsWith('http') && trimmed.includes('x.ai') // xAI 临时 URL 可能过期
  ) {
    console.warn('[Image Guard] 检测到无效/异常图片地址，使用 fallback:', trimmed);
    return undefined;
  }

  // data URL / blob URL 直接使用
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // 协议相对 URL
  if (trimmed.startsWith("//")) {
    return `${window.location.protocol}${trimmed}`;
  }

  // 绝对 URL：修正 localhost 主机
  if (/^https?:\/\//i.test(trimmed)) {
    if (LOCAL_HOST_RE.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  // 站内路径：补齐前缀，避免被当前路由拼接
  if (trimmed.startsWith("/")) {
    return `${window.location.origin}${trimmed}`;
  }

  return `${window.location.origin}/${trimmed}`;
}
