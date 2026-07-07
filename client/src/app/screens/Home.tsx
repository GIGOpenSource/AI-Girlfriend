import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { sortCompanionsByUserLang } from "../utils/companionLang";
import { TabBar } from "../components/TabBar";
import { AvatarImage } from "../components/AvatarImage";
import { MomentImage } from "../components/MomentImage";
import { Bell, Plus, Heart, MessageCircle, X, Send, ChevronUp, Filter } from "lucide-react";
import { useNavigate } from "react-router";

interface Companion {
  id: string;
  name: string;
  avatar: string;
  affection: number;
  gender?: string;
  avatar_generating?: boolean;
}

interface MomentItem {
  id: number;
  companion_id: string;
  companion_name?: string;
  companion_gender?: string;
  companion_avatar?: string;
  image_url: string;
  image_generating?: boolean;
  caption: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked: boolean;
  comments?: Array<{
    id: number;
    is_user: boolean;
    companion_id: string | null;
    companion_name: string;
    content: string;
    created_at: string;
    parent_id?: number | null;
    reply_to_name?: string | null;
  }>;
}

function formatRelativeTime(isoTime: string, t: (k: string, o?: any) => string): string {
  if (!isoTime) return "";
  const date = new Date(isoTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('home.justNow');
  if (diffMin < 60) return t('home.minutesAgo', { count: diffMin });
  if (diffHour < 24) return t('home.hoursAgo', { count: diffHour });
  if (diffDay < 7) return t('home.daysAgo', { count: diffDay });
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("device_id", id);
  }
  return id;
}

export function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<number, boolean>>({});
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const deviceId = getDeviceId();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const PAGE_SIZE = 20;

  /** Moments 筛选：语种 / 性别 / 性取向（空字符串表示不限） */
  const [momentFilterLang, setMomentFilterLang] = useState("");
  const [momentFilterGender, setMomentFilterGender] = useState("");
  const [momentFilterOrientation, setMomentFilterOrientation] = useState("");
  const [showMomentFilter, setShowMomentFilter] = useState(false);
  const [draftFilterLang, setDraftFilterLang] = useState("");
  const [draftFilterGender, setDraftFilterGender] = useState("");
  const [draftFilterOrientation, setDraftFilterOrientation] = useState("");

  /** 筛选条件用 ref 同步，避免改动筛选时重建 loadMomentsPage → 触发二次全量刷新（与「应用」按钮重复请求） */
  const momentFiltersRef = useRef({
    filter_lang: "",
    gender: "",
    orientation: "",
  });
  momentFiltersRef.current = {
    filter_lang: momentFilterLang,
    gender: momentFilterGender,
    orientation: momentFilterOrientation,
  };

  /** 与消息列表一致：仅显示有过对话的智能体 */
  const hasChatted = (c: { state?: { turns?: number }; last_message?: string | null }) =>
    (c.state?.turns ?? 0) > 0 || Boolean(c.last_message);

  const loadCompanionStrip = useCallback(async () => {
    const companionsRes = await fetch("/companions").then((r) => r.json());
    const userLang = i18n.language || "zh";
    const sorted = sortCompanionsByUserLang(companionsRes || [], userLang);
    const withChat = sorted.filter((c: any) => hasChatted(c));
    setCompanions(
      withChat.map((c: any) => ({
        id: c.profile?.id || "",
        name: c.profile?.name || t("home.defaultCompanionName"),
        avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profile?.id}`,
        affection: c.state?.affection || 0,
        gender: c.profile?.gender || "",
        avatar_generating: c.avatar_generating,
      }))
    );
  }, [i18n.language, t]);

  const loadMomentsPage = useCallback(
    async (
      isRefresh: boolean,
      filters?: { filter_lang?: string; gender?: string; orientation?: string }
    ) => {
      const currentOffset = isRefresh ? 0 : offsetRef.current;
      const fl = filters?.filter_lang ?? momentFiltersRef.current.filter_lang;
      const fg = filters?.gender ?? momentFiltersRef.current.gender;
      const fo = filters?.orientation ?? momentFiltersRef.current.orientation;
      const mq = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(currentOffset),
        lang: i18n.language || "zh",
      });
      if (fl) mq.set("filter_lang", fl);
      if (fg) mq.set("gender", fg);
      if (fo) mq.set("orientation", fo);

      const momentsRes = await fetch(`/api/moments?${mq.toString()}`, {
        headers: { "x-device-id": deviceId },
      }).then((r) => r.json());

      const newMoments: MomentItem[] = momentsRes.moments || [];
      const newTotal = momentsRes.total || 0;

      const nextOffset = currentOffset + newMoments.length;
      offsetRef.current = nextOffset;

      if (isRefresh) {
        setMoments(newMoments);
      } else {
        setMoments((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueNew = newMoments.filter((m) => !existingIds.has(m.id));
          return [...prev, ...uniqueNew];
        });
      }

      setHasMore(nextOffset < newTotal);

      if (isRefresh) {
        const lastViewed = localStorage.getItem("moments_last_viewed");
        const unread = newMoments.some((m) => {
          if (!lastViewed) return true;
          return new Date(m.created_at).getTime() > new Date(lastViewed).getTime();
        });
        setHasUnread(unread);
      }
    },
    [deviceId, i18n.language]
  );

  const performFullRefresh = useCallback(
    async (isPull: boolean) => {
      if (isPull) setRefreshing(true);
      else setLoading(true);
      try {
        await Promise.all([loadCompanionStrip(), loadMomentsPage(true)]);
      } catch (e) {
        console.error("加载失败:", e);
      } finally {
        if (isPull) setRefreshing(false);
        else setLoading(false);
      }
    },
    [loadCompanionStrip, loadMomentsPage]
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      await loadMomentsPage(false);
    } catch (e) {
      console.error("加载更多失败:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, loadMomentsPage]);

  useEffect(() => {
    performFullRefresh(false);
  }, [performFullRefresh]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) void loadCompanionStrip();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadCompanionStrip]);

  // 主滚动在 overflow 容器上，不冒泡到 document；首屏 loading 时 ref 未挂载，需在内容出现后绑定
  useEffect(() => {
    if (loading) return;
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowBackToTop(el.scrollTop > 200);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  // Intersection Observer for infinite scroll（每页 20 条，滑到底继续加载）
  useEffect(() => {
    const el = loadMoreRef.current;
    const root = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { root: root ?? undefined, rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore, moments.length]);

  const scrollHomeToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    if (containerRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && diff < 120) {
      setPullDistance(diff);
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance > 80 && !refreshing) {
      setPullDistance(0);
      void performFullRefresh(true);
    } else {
      setPullDistance(0);
    }
  };

  const handleLike = async (momentId: number, _currentlyLiked: boolean) => {
    try {
      const res = await fetch(`/api/moments/${momentId}/like`, {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
      const data = await res.json();
      if (data.ok) {
        setMoments((prev) =>
          prev.map((m) =>
            m.id === momentId
              ? { ...m, liked: data.liked, likes_count: data.likes_count }
              : m
          )
        );
      }
    } catch (e) {
      console.error("点赞失败:", e);
    }
  };

  const handleComment = async (momentId: number) => {
    const content = commentInputs[momentId]?.trim();
    if (!content) return;

    setCommentLoading((prev) => ({ ...prev, [momentId]: true }));
    try {
      const res = await fetch(`/api/moments/${momentId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.ok) {
        setCommentInputs((prev) => ({ ...prev, [momentId]: "" }));
        const newComments = [
          ...(moments.find((m) => m.id === momentId)?.comments || []),
          {
            id: data.id,
            is_user: true,
            companion_id: null,
            companion_name: "我",
            content: data.content,
            created_at: data.created_at,
          },
        ];
        if (data.ai_reply) {
          newComments.push(data.ai_reply);
        }
        setMoments((prev) =>
          prev.map((m) =>
            m.id === momentId
              ? {
                  ...m,
                  comments_count: (m.comments_count || 0) + (data.ai_reply ? 2 : 1),
                  comments: newComments,
                }
              : m
          )
        );
      }
    } catch (e) {
      console.error("评论失败:", e);
    } finally {
      setCommentLoading((prev) => ({ ...prev, [momentId]: false }));
    }
  };

  const getCompanionById = (id: string): Companion | undefined => {
    return companions.find((c) => c.id === id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background pb-24 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-muted-foreground text-sm transition-all"
          style={{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / 80, 1) }}
        >
          <div className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {refreshing ? t('common.loading') : pullDistance > 80 ? t('common.loading') : t('common.loading')}
        </div>
      )}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl text-foreground">Moments</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              data-analytics-button="home-moment-filter"
              data-analytics-name="首页朋友圈筛选"
              onClick={() => {
                setDraftFilterLang(momentFilterLang);
                setDraftFilterGender(momentFilterGender);
                setDraftFilterOrientation(momentFilterOrientation);
                setShowMomentFilter(true);
              }}
              aria-label={t("home.momentFilter")}
            >
              <Filter className="w-6 h-6 text-foreground" />
              {(momentFilterLang || momentFilterGender || momentFilterOrientation) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full" />
              )}
            </button>
            <button
              className="relative p-2"
              data-analytics-button="home-notification"
              data-analytics-name="首页通知铃铛"
              onClick={() => {
                localStorage.setItem("moments_last_viewed", new Date().toISOString());
                setHasUnread(false);
                navigate("/notifications");
              }}
            >
              <Bell className="w-6 h-6 text-foreground" />
              {hasUnread && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-border overflow-x-auto">
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/create")}
            className="flex-shrink-0 text-center"
            data-analytics-button="home-create-companion"
            data-analytics-name="首页创建伴侣"
          >
            <div className="w-16 h-16 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center mb-2">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{t('home.create')}</p>
          </button>
          {companions.map((companion) => (
            <button
              key={companion.id}
              onClick={() => navigate(`/companion/${companion.id}`)}
              className="flex-shrink-0 text-center"
              data-analytics-button={`home-companion-${companion.id}`}
              data-analytics-name={`首页进入伴侣-${companion.name}`}
            >
              <div className="relative mb-2">
                {companion.avatar_generating ? (
                  <div className="w-16 h-16 rounded-full bg-muted border-2 border-pink-500 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
                  </div>
                ) : (
                  <AvatarImage
                    src={companion.avatar}
                    seed={companion.id}
                    alt={companion.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-pink-500"
                  />
                )}
              </div>
              <p className="text-xs text-foreground">{companion.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border">
        {moments.length === 0 && (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            {t('home.noMoments')}
          </div>
        )}
        {moments.map((moment) => {
          const companion = getCompanionById(moment.companion_id);
          const displayName = moment.companion_name || companion?.name || t("home.defaultCompanionName");
          const displayGender = moment.companion_gender ?? companion?.gender;
          return (
            <div key={moment.id} className="bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => navigate(`/companion/${moment.companion_id}`)}
                  className="cursor-pointer"
                >
                  <AvatarImage
                    src={moment.companion_avatar || companion?.avatar}
                    seed={moment.companion_id}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-foreground text-sm">{displayName}</p>
                    {displayGender === "男" && (
                      <span className="text-blue-400 text-xs">♂</span>
                    )}
                    {displayGender === "女" && (
                      <span className="text-pink-400 text-xs">♀</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatRelativeTime(moment.created_at, t)}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-3">
                <p className="text-foreground text-sm">{moment.caption}</p>
              </div>

              {moment.image_generating ? (
                <div className="w-full aspect-square bg-muted flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="text-muted-foreground text-sm">图片生成中...</span>
                </div>
              ) : (
                <MomentImage
                  src={moment.image_url}
                  alt="moment"
                  className="w-full aspect-square object-cover cursor-pointer"
                  onClick={() => setPreviewImage(moment.image_url)}
                />
              )}

              <div className="px-4 py-3">
                <div className="flex items-center gap-4 mb-2">
                  <button
                    className="flex items-center gap-2"
                    data-analytics-button="home-moment-like"
                    data-analytics-name="首页朋友圈点赞"
                    onClick={() => handleLike(moment.id, moment.liked)}
                  >
                    <Heart
                      className={`w-6 h-6 ${
                        moment.liked ? "fill-pink-500 text-pink-500" : "text-foreground"
                      }`}
                    />
                    <span className="text-sm text-foreground">{moment.likes_count}</span>
                  </button>
                  <button
                    className="flex items-center gap-2"
                    data-analytics-button="home-moment-comment"
                    data-analytics-name="首页朋友圈评论"
                    onClick={() => navigate(`/moments/${moment.id}`)}
                  >
                    <MessageCircle className="w-6 h-6 text-foreground" />
                    <span className="text-sm text-foreground">{moment.comments_count}</span>
                  </button>
                </div>

                {/* 评论区域 */}
                {moment.comments && moment.comments.length > 0 && (
                  <div className="mt-3 space-y-2 bg-muted/30 rounded-lg p-3">
                    {moment.comments.map((comment) => (
                      <div key={comment.id} className="text-xs">
                        <span
                          className={`font-medium mr-1 ${
                            comment.is_user ? "text-pink-500" : "text-primary"
                          }`}
                        >
                          {comment.companion_name}
                        </span>
                        <span className="text-foreground/80">
                          {comment.reply_to_name && (
                            <span className="text-primary font-medium">
                              @{comment.reply_to_name}{" "}
                            </span>
                          )}
                          {comment.content}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 用户评论输入 */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    id={`home-moment-comment-${moment.id}`}
                    name={`moment_comment_${moment.id}`}
                    type="text"
                    autoComplete="off"
                    value={commentInputs[moment.id] || ""}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({
                        ...prev,
                        [moment.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleComment(moment.id);
                      }
                    }}
                    placeholder={t('home.writeComment')}
                    className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => handleComment(moment.id)}
                    disabled={commentLoading[moment.id] || !commentInputs[moment.id]?.trim()}
                    className="p-2 text-primary disabled:text-muted-foreground"
                    data-analytics-button="home-send-comment"
                    data-analytics-name="首页发送评论"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* 懒加载 sentinel & 加载状态 */}
        <div ref={loadMoreRef} className="py-4 text-center">
          {loadingMore && (
            <div className="text-muted-foreground text-sm flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('common.loading')}
            </div>
          )}
          {!hasMore && moments.length > 0 && (
            <div className="text-muted-foreground text-xs">{t("home.noMoreMoments")}</div>
          )}
        </div>
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={scrollHomeToTop}
          className="fixed z-40 bottom-20 right-4 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          data-analytics-button="home-back-to-top"
          data-analytics-name="首页返回顶部"
          aria-label={t("home.backToTop")}
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}

      {showMomentFilter && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => setShowMomentFilter(false)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground text-lg">{t("home.momentFilter")}</h3>
              <button
                type="button"
                onClick={() => setShowMomentFilter(false)}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t("home.filterLanguage")}</label>
                <select
                  value={draftFilterLang}
                  onChange={(e) => setDraftFilterLang(e.target.value)}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t("home.filterAll")}</option>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                  <option value="pt">Português</option>
                  <option value="es">Español</option>
                  <option value="id">Bahasa Indonesia</option>
                </select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t("home.filterGender")}</label>
                <select
                  value={draftFilterGender}
                  onChange={(e) => setDraftFilterGender(e.target.value)}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t("home.filterAll")}</option>
                  <option value="男">{t("register.male")}</option>
                  <option value="女">{t("register.female")}</option>
                </select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t("home.filterOrientation")}</label>
                <select
                  value={draftFilterOrientation}
                  onChange={(e) => setDraftFilterOrientation(e.target.value)}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t("home.filterAll")}</option>
                  <option value="heterosexual">{t("register.heterosexual")}</option>
                  <option value="homosexual">{t("register.homosexual")}</option>
                  <option value="bisexual">{t("register.bisexual")}</option>
                  <option value="pansexual">{t("register.pansexual")}</option>
                  <option value="asexual">{t("register.asexual")}</option>
                  <option value="secret">{t("register.secret")}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors"
                onClick={() => {
                  setDraftFilterLang("");
                  setDraftFilterGender("");
                  setDraftFilterOrientation("");
                  setMomentFilterLang("");
                  setMomentFilterGender("");
                  setMomentFilterOrientation("");
                  offsetRef.current = 0;
                  setShowMomentFilter(false);
                  void (async () => {
                    setLoading(true);
                    try {
                      await Promise.all([
                        loadCompanionStrip(),
                        loadMomentsPage(true, {
                          filter_lang: "",
                          gender: "",
                          orientation: "",
                        }),
                      ]);
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
              >
                {t("home.resetFilter")}
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                onClick={() => {
                  setMomentFilterLang(draftFilterLang);
                  setMomentFilterGender(draftFilterGender);
                  setMomentFilterOrientation(draftFilterOrientation);
                  offsetRef.current = 0;
                  setShowMomentFilter(false);
                  void (async () => {
                    setLoading(true);
                    try {
                      await Promise.all([
                        loadCompanionStrip(),
                        loadMomentsPage(true, {
                          filter_lang: draftFilterLang,
                          gender: draftFilterGender,
                          orientation: draftFilterOrientation,
                        }),
                      ]);
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
              >
                {t("home.applyFilter")}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            data-analytics-button="home-close-preview"
            data-analytics-name="首页关闭图片预览"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <MomentImage
            src={previewImage}
            alt="preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <TabBar />
    </div>
  );
}
