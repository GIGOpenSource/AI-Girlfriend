import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { imageCrossOriginForUrl, normalizeMediaUrl } from "../utils/media";

interface MomentImageProps {
  src?: string;
  alt?: string;
  className?: string;
  onClick?: (e?: React.MouseEvent<HTMLImageElement>) => void;
}

/**
 * 统一朋友圈/配图组件，内置加载失败 fallback。
 * fallback 为简洁的占位图（与现有 base64 占位图一致）。
 */
const FALLBACK_SVG =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4=';

function MomentImageComponent({ src, alt = "", className = "", onClick }: MomentImageProps) {
  const [hasError, setHasError] = useState(false);

  // 仅在 src 真正变化时重置状态，避免频繁闪烁
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
    }
  }, [hasError]);

  const handleLoad = useCallback(() => {
    // 占位图 onLoad 时不能清空 hasError，否则会再次请求已 404 的原图，造成疯狂重试与后端日志刷屏
    if (hasError) return;
    setHasError(false);
  }, [hasError]);

  const normalizedSrc = useMemo(() => normalizeMediaUrl(src), [src]);

  // 关键优化：优先使用有效图片，只有确认错误后才用稳定 fallback
  // 避免 normalizedSrc 频繁变化导致的闪烁
  const finalSrc = useMemo(() => {
    if (!hasError && normalizedSrc && normalizedSrc !== "__GENERATING__") {
      return normalizedSrc;
    }
    return FALLBACK_SVG;
  }, [normalizedSrc, hasError]);

  const crossOrigin = useMemo(() => imageCrossOriginForUrl(finalSrc), [finalSrc]);

  // 使用原始 src 作为 key，减少不必要的 img 元素重挂载
  const imageKey = src || "moment-fallback";

  return (
    <img
      key={imageKey}
      src={finalSrc}
      alt={alt || "Moment image"}
      className={className}
      loading="lazy"
      onError={handleError}
      onLoad={handleLoad}
      onClick={onClick}
      decoding="async"
      crossOrigin={crossOrigin}
      referrerPolicy="no-referrer"
    />
  );
}

export const MomentImage = memo(MomentImageComponent);
