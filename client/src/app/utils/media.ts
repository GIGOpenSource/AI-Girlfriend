const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;

/**
 * 图片仅用于展示（无 canvas 取像素需求），故一律不设 crossOrigin。
 * 设置 crossOrigin="anonymous" 会强制浏览器走 CORS 校验，外链图床（如 COS）
 * 若未对当前来源（如局域网 IP）开放 CORS 白名单，图片会被直接拦截而加载失败。
 */
export function imageCrossOriginForUrl(_url: string): "anonymous" | undefined {
  return undefined;
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

  // 绝对 URL：修正 localhost / 127.0.0.1 / 0.0.0.0 / 当前站点 LAN IP 等主机。
  // 统一改写为「当前页面源 + 路径」，使图片经 Vite 代理（/data → 后端）加载，
  // 避免局域网以 IP 访问时：1) 直接打后端 8000 端口被防火墙/绑定拦截；2) 跨源触发 CORS 加载失败。
  if (/^https?:\/\//i.test(trimmed)) {
    const isLocalHost = LOCAL_HOST_RE.test(trimmed);
    let isSameHost = false;
    try {
      if (typeof window !== "undefined") {
        const parsed = new URL(trimmed);
        isSameHost = parsed.hostname === window.location.hostname;
      }
    } catch {
      isSameHost = false;
    }
    if (isLocalHost || isSameHost) {
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
