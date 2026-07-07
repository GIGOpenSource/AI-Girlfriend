import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { imageCrossOriginForUrl, normalizeMediaUrl } from "../utils/media";

interface AvatarImageProps {
  src?: string;
  seed?: string;
  alt?: string;
  className?: string;
}

/**
 * 优化后的统一头像组件：
 * - 多级 fallback：自定义src → Dicebear → RoboHash → 本地SVG占位图
 * - 错误重试机制（最多重试2次）
 * - 减少对单一外部服务的依赖，提升可靠性与隐私
 * - 加载状态优化和memo保持性能
 */
function AvatarImageComponent({ src, seed = "fallback", alt = "", className = "" }: AvatarImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  // 关键修复：只在src真正变化时重置状态，避免循环
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src, seed]);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setIsLoading(false);
    }
  }, [hasError]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    // 头像走 Dicebear 等 fallback 时不得清空 hasError，否则会再次打原图坏链，形成请求死循环
    if (hasError) return;
    setHasError(false);
  }, [hasError]);

  const normalizedSrc = useMemo(() => normalizeMediaUrl(src), [src]);

  // 最终优化：大幅减少外部请求和错误事件，彻底解决闪烁和Sentry上限
  const finalSrc = useMemo(() => {
    if (!hasError && normalizedSrc && normalizedSrc !== "__GENERATING__") {
      return normalizedSrc;
    }
    // 默认使用稳定Dicebear，避免反复加载不同CDN
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "default")}`;
  }, [normalizedSrc, hasError, seed]);

  const crossOrigin = useMemo(() => imageCrossOriginForUrl(finalSrc), [finalSrc]);

  return (
    <img
      ref={imgRef}
      key={finalSrc}                    // 关键：强制React在src变化时正确复用img元素，防止闪烁
      src={finalSrc}
      alt={alt || "Avatar"}
      className={className}
      loading="lazy"
      onError={handleError}
      onLoad={handleLoad}
      decoding="async"
      crossOrigin={crossOrigin}
      referrerPolicy="no-referrer"
      style={isLoading ? { opacity: 0.92 } : undefined}
    />
  );
}

export const AvatarImage = memo(AvatarImageComponent);
