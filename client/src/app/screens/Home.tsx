// ====================================================================
// React 核心 hooks：
//   useState  → 组件状态管理（列表数据、加载态、UI 开关等）
//   useEffect → 副作用处理（首屏加载、滚动监听、可见性变化）
//   useCallback → 缓存函数引用，避免子组件/依赖项无意义重建
//   useRef    → 保存不触发重渲染的可变值（DOM 引用、分页 offset 等）
// ====================================================================
import { useState, useEffect, useCallback, useRef } from "react";
// i18n 多语言：t() 翻译函数，i18n.language 当前语言
import { useTranslation } from "react-i18next";
// 工具函数：根据用户语言对智能体列表排序（同语种优先）
import { sortCompanionsByUserLang } from "../utils/companionLang";
// 底部导航栏
import { TabBar } from "../components/TabBar";
// 头像组件：自动 fallback + 生成中 spinner
import { AvatarImage } from "../components/AvatarImage";
// 朋友圈图片组件：加载失败时展示 placeholder
import { MomentImage } from "../components/MomentImage";
// lucide-react 图标库
import { Bell, Plus, Heart, MessageCircle, X, Send, ChevronUp, Filter, Loader2 } from "lucide-react";
// 编程式路由跳转
import { useNavigate } from "react-router";
// 统一 API 客户端：自动注入 x-token
import { apiFetch, api } from "../utils/api";

// ====================================================================
// Companion 类型：顶部横向头像条中的智能体
// ====================================================================
interface Companion {
  id: string;                    // 智能体唯一 ID
  name: string;                  // 显示名称
  avatar: string;                // 头像 URL
  affection: number;             // 好感度
  gender?: string;               // 性别（男/女/保密）
  avatar_generating?: boolean;   // 头像是否还在生成中
}

// ====================================================================
// MomentItem 类型：朋友圈一条动态
// ====================================================================
interface MomentItem {
  id: number;                          // 动态 ID
  companion_id: string;                // 发布者（智能体）ID
  companion_name?: string;             // 发布者名称
  companion_gender?: string;           // 发布者性别
  companion_avatar?: string;           // 发布者头像
  image_url: string;                   // 朋友圈图片
  image_generating?: boolean;          // 图片是否还在生成中
  caption: string;                     // 文案
  likes_count: number;                 // 点赞数
  comments_count: number;              // 评论数
  created_at: string;                  // 发布时间（ISO 字符串）
  liked: boolean;                      // 当前用户是否已点赞
  comments?: Array<{
    id: number;                        // 评论 ID
    user_id?: number | null;          // 评论者用户 ID（当前登录用户才用于判断高亮）
    is_user: boolean;                  // 是否用户自己的评论
    companion_id: string | null;       // 评论者智能体 ID（用户评论时为 null）
    companion_name: string;            // 评论者名称
    content: string;                   // 评论内容
    created_at: string;                // 评论时间
    parent_id?: number | null;         // 父评论 ID（回复场景）
    reply_to_name?: string | null;     // 回复给谁的名字（@xxx）
  }>;
}

// ====================================================================
// 将 ISO 时间转为相对时间文案（如"刚刚""3分钟前""2小时前""3天前"）
// 超过 7 天则显示具体日期（如"5月12日"）
// ====================================================================
function formatRelativeTime(isoTime: string, t: (k: string, o?: any) => string): string {
  if (!isoTime) return "";
  const date = new Date(isoTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('home.justNow');        // < 1分钟 → "刚刚"
  if (diffMin < 60) return t('home.minutesAgo', { count: diffMin });  // < 1小时 → "X分钟前"
  if (diffHour < 24) return t('home.hoursAgo', { count: diffHour });  // < 1天 → "X小时前"
  if (diffDay < 7) return t('home.daysAgo', { count: diffDay });      // < 7天 → "X天前"
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });  // 超过7天 → "5月12日"
}

// ====================================================================
// 获取/生成设备唯一标识
// 先从 localStorage 读，没有就随机生成一个并持久化
// 注意：这不是登录账号标识！同一台设备不同账号登录，deviceId 不变
//       朋友圈数据按 deviceId 分流，不是按 user_token
// ====================================================================
function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    // 生成随机 13 位字符串作为设备 ID
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("device_id", id);
  }
  return id;
}

function getCurrentUserId(): number | null {
  const infoStr = localStorage.getItem("user_info");
  if (!infoStr) return null;
  try {
    const info = JSON.parse(infoStr);
    return info.id ?? null;
  } catch {
    return null;
  }
}

function isCommentByMe(userId?: number | null): boolean {
  const currentUserId = getCurrentUserId();
  return userId != null && currentUserId != null && userId === currentUserId;
}

// ====================================================================
// Home 页面主组件
// 功能：仿微信朋友圈首页
//   - 顶部智能体头像条（横向滚动，含创建按钮）
//   - 朋友圈动态列表（无限滚动 + 下拉刷新）
//   - 点赞/评论交互
//   - 筛选（语言/性别/性取向）
//   - 图片预览大图
// ====================================================================
export function Home() {
  // ───────────────── 路由 & 国际化 ─────────────────
  const navigate = useNavigate();                    // 编程式路由跳转
  const { t, i18n } = useTranslation();              // t=翻译函数, i18n.language=当前语言

  // ───────────────── 数据状态 ─────────────────
  const [companions, setCompanions] = useState<Companion[]>([]);          // 顶部横向智能体头像列表
  const [moments, setMoments] = useState<MomentItem[]>([]);               // 朋友圈动态列表

  // ───────────────── 加载状态 ─────────────────
  const [loading, setLoading] = useState(true);         // 首次加载 → 全屏 loading spinner
  const [refreshing, setRefreshing] = useState(false);  // 下拉刷新中
  const [loadingMore, setLoadingMore] = useState(false); // 滑到底加载更多
  const [hasMore, setHasMore] = useState(true);         // 是否还有下一页（控制无限滚动）

  // ───────────────── UI 交互状态 ─────────────────
  const [pullDistance, setPullDistance] = useState(0);              // 下拉距离(px)，控制顶部提示条高度
  const [previewImage, setPreviewImage] = useState<string | null>(null); // 大图预览 URL，null=关闭
  const [hasUnread, setHasUnread] = useState(false);               // 铃铛小红点
  const [showBackToTop, setShowBackToTop] = useState(false);       // 是否显示"回到顶部"按钮
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});    // 每条动态的评论输入内容 {momentId: text}
  const [commentLoading, setCommentLoading] = useState<Record<number, boolean>>({}); // 每条动态的评论发送中

  // ───────────────── DOM/非渲染引用（useRef：改值不触发重新渲染） ─────────────────
  const deviceId = getDeviceId();                           // 设备唯一 ID（用于 API 请求头）
  const containerRef = useRef<HTMLDivElement>(null);        // 页面滚动容器 DOM
  const loadMoreRef = useRef<HTMLDivElement>(null);         // 底部哨兵 DOM（IntersectionObserver 监听）
  const touchStartY = useRef(0);                            // 触摸起始 Y 坐标
  const isPulling = useRef(false);                          // 是否正在下拉
  const offsetRef = useRef(0);                              // 分页偏移量（存 ref 避免闭包过期问题）
  const PAGE_SIZE = 5;                                     // 每页动态数量

  // ───────────────── 筛选条件（Moments Filter） ─────────────────
  // 生效中的筛选值（momentFilter*）→ 实时影响 API 请求
  const [momentFilterLang, setMomentFilterLang] = useState("");               // 语种筛选
  const [momentFilterGender, setMomentFilterGender] = useState("");           // 性别筛选
  const [momentFilterOrientation, setMomentFilterOrientation] = useState(""); // 性取向筛选
  const [showMomentFilter, setShowMomentFilter] = useState(false);            // 筛选弹窗开关

  // 草稿筛选值（draftFilter*）→ 弹窗内修改，点"应用"才同步到 momentFilter*
  const [draftFilterLang, setDraftFilterLang] = useState("");
  const [draftFilterGender, setDraftFilterGender] = useState("");
  const [draftFilterOrientation, setDraftFilterOrientation] = useState("");

  // 筛选值用 ref 同步一份，供 loadMomentsPage 内部闭包使用
  // 避免 useCallback 依赖筛选 state → 每次筛选变化重建函数 → 触发不必要请求
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

  // ───────────────── 工具判断（暂不使用）─────────────────
  // 判断智能体是否与用户有过对话
  //   - turns > 0（对话轮数 > 0）
  //   - 或 last_message 有值（有过最后一条消息）
  // const hasChatted = (c: { state?: { turns?: number }; last_message?: string | null }) =>
  //   (c.state?.turns ?? 0) > 0 || Boolean(c.last_message);

  // ====================================================================
  // 加载顶部智能体头像条
  // 流程：
  //   1. GET /companions 获取全部智能体
  //   2. 按用户语言排序（同语言优先）
  //   3. 映射为 Companion 格式并更新 state
  // （旧逻辑：filter(hasChatted) 只显示有对话记录的，先注释保留）
  // ====================================================================
  const loadCompanionStrip = useCallback(async () => {
    // apiFetch 自动注入 x-token，后端可按登录账户分流
    const companionsRes = await api.get(`/companions?${new URLSearchParams({ filter_type: "chatted" }).toString()}`);
    console.log("=== /companions 接口返回 ===" ,companionsRes);
    const userLang = i18n.language || "zh";
    // 按语言排序，当前语言相同排最前
    const sorted = sortCompanionsByUserLang(companionsRes || [], userLang);
    // [暂时] 不做过滤，后端返回多少就显示多少
    // 旧逻辑: const withChat = sorted.filter((c: any) => hasChatted(c));
    console.log("顶部智能体数量:", sorted.length);
    setCompanions(
      sorted.map((c: any) => ({
        id: c.profile?.id || "",
        name: c.profile?.name || t("home.defaultCompanionName"),
        // 没有头像时用 dicebear 生成默认头像
        avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profile?.id}`,
        affection: c.state?.affection || 0,
        gender: c.profile?.gender || "",
        avatar_generating: c.avatar_generating,
      }))
    );
  }, [i18n.language, t]);

  // ====================================================================
  // 加载朋友圈动态（分页）
  // 参数：
  //   isRefresh: true=刷新（offset=0, 替换列表）, false=加载更多（追加）
  //   filters:   可选的筛选参数，不传则从 momentFiltersRef 取
  // 请求头：x-device-id（按设备分流，非按账户）
  // ====================================================================
  const loadMomentsPage = useCallback(
    async (
      isRefresh: boolean,
      filters?: { filter_lang?: string; gender?: string; orientation?: string }
    ) => {
      // 刷新时 offset 归零，否则取上次加载到的位置
      const currentOffset = isRefresh ? 0 : offsetRef.current;
      // 优先用传入 filters，否则用 ref 中存的当前筛选值
      const fl = filters?.filter_lang ?? momentFiltersRef.current.filter_lang;
      const fg = filters?.gender ?? momentFiltersRef.current.gender;
      const fo = filters?.orientation ?? momentFiltersRef.current.orientation;
      // 拼接查询参数
      const mq = new URLSearchParams({
        limit: String(PAGE_SIZE),      // 每页 20 条
        offset: String(currentOffset),
        lang: i18n.language || "zh",
      });
      if (fl) mq.set("filter_lang", fl);
      if (fg) mq.set("gender", fg);
      if (fo) mq.set("orientation", fo);

      // apiFetch 自动注入 x-token，同时保留 x-device-id 用于设备维度数据
      const momentsRes = await apiFetch(`/api/moments?${mq.toString()}`, {
        headers: { "x-device-id": deviceId },
      });

      const newMoments: MomentItem[] = momentsRes.moments || [];
      const newTotal = momentsRes.total || 0;            // 后端总条数

      // 更新分页 offset
      const nextOffset = currentOffset + newMoments.length;
      offsetRef.current = nextOffset;

      if (isRefresh) {
        // 刷新 → 直接替换列表
        setMoments(newMoments);
      } else {
        // 加载更多 → 去重后追加
        setMoments((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueNew = newMoments.filter((m) => !existingIds.has(m.id));
          return [...prev, ...uniqueNew];
        });
      }

      // 判断是否还有下一页
      setHasMore(nextOffset < newTotal);

      // 检测未读动态（用于铃铛小红点）
      if (isRefresh) {
        const lastViewed = localStorage.getItem("moments_last_viewed");
        const unread = newMoments.some((m) => {
          if (!lastViewed) return true;   // 从未看过 → 全部标记未读
          return new Date(m.created_at).getTime() > new Date(lastViewed).getTime();
        });
        setHasUnread(unread);
      }
    },
    [deviceId, i18n.language]
  );

  // ====================================================================
  // 全量刷新：同时拉取智能体列表 + 朋友圈首页
  // 场景：
  //   isPull=true  → 下拉刷新（refreshing 状态）
  //   isPull=false → 首次加载（loading 状态）
  // ====================================================================
  const performFullRefresh = useCallback(
    async (isPull: boolean) => {
      // 根据刷新方式设置不同的加载标记
      if (isPull) setRefreshing(true);
      else setLoading(true);
      try {
        // 并行加载，提升速度
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

  // ====================================================================
  // 滚动到底部 → 加载下一页动态
  // 前置条件：不在 loadingMore / 没有更多 / 首页还在 loading
  // ====================================================================
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;   // 防重复加载
    setLoadingMore(true);
    try {
      await loadMomentsPage(false);   // false = 追加模式
    } catch (e) {
      console.error("加载更多失败:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, loadMomentsPage]);

  // ====================================================================
  // 副作用 & 生命周期
  // ====================================================================

  // 【1】组件挂载时执行首次全量加载
  useEffect(() => {
    performFullRefresh(false);                    // false = 首次加载（loading spinner）
  }, [performFullRefresh]);

  // 【2】页面从后台切回前台时，刷新智能体头像条
  //     场景：用户在聊天页创建了新智能体，切回首页自动刷新
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) void loadCompanionStrip();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadCompanionStrip]);

  // 【3】监听滚动容器，滚动超过 200px 显示"回到顶部"按钮
  //     等首屏 loading 结束后再绑定（此时 DOM 已渲染）
  useEffect(() => {
    if (loading) return;                          // 首屏 loading 中，ref 可能未挂载
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowBackToTop(el.scrollTop > 200);
    };
    onScroll();                                   // 立即检查当前滚动位置
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  // 【4】IntersectionObserver 实现无限滚动
  //     监听底部哨兵元素（loadMoreRef），进入视口 200px 前触发 loadMore
  useEffect(() => {
    const el = loadMoreRef.current;
    const root = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 哨兵可见 + 还有更多 + 没在加载中 + 首页已完成
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { root: root ?? undefined, rootMargin: "200px" } // 提前 200px 触发
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore, moments.length]);

  // ====================================================================
  // 滚动到顶部（平滑动画）
  // ====================================================================
  const scrollHomeToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ====================================================================
  // 下拉刷新：Touch 事件三件套
  // 原理：
  //   touchStart → 记录起始 Y（仅当滚动条已在顶部）
  //   touchMove  → 计算下拉距离，实时更新 pullDistance（带动画高度）
  //   touchEnd   → 超过阈值(80px)触发刷新，否则回弹
  // ====================================================================
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    // 只在滚动到顶部时才触发下拉逻辑（否则会干扰正常滚动）
    if (containerRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    // 只处理向下拉（diff>0），最大 120px
    if (diff > 0 && diff < 120) {
      setPullDistance(diff);
      e.preventDefault();                     // 阻止页面弹性滚动
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    // 下拉超过 80px 且没在刷新中 → 触发刷新
    if (pullDistance > 80 && !refreshing) {
      setPullDistance(0);                     // 收起下拉提示
      void performFullRefresh(true);          // true = 下拉刷新模式
    } else {
      setPullDistance(0);                     // 不够距离，回弹
    }
  };

  // ====================================================================
  // 点赞/取消点赞
  // POST /api/moments/:id/like → 后端返回 {ok, liked, likes_count}
  // 乐观更新 likes_count，不依赖刷新
  // ====================================================================
  const handleLike = async (momentId: number, _currentlyLiked: boolean) => {
    try {
      const data = await apiFetch(`/api/moments/${momentId}/like`, {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
      if (data.ok) {
        // 只更新这一条动态的点赞状态和数量
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

  // ====================================================================
  // 发送评论
  // 流程：
  //   1. POST /api/moments/:id/comment（body: {content}）
  //   2. 后端返回 {ok, id, content, created_at, ai_reply?}
  //   3. 前端乐观更新：把用户评论 + AI 回复追加到 comments 列表
  // ====================================================================
  const handleComment = async (momentId: number) => {
    const content = commentInputs[momentId]?.trim();
    if (!content) return;

    setCommentLoading((prev) => ({ ...prev, [momentId]: true }));
    try {
      const data = await apiFetch(`/api/moments/${momentId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({ content }),
      });
      if (data.ok) {
        // 清空输入框
        setCommentInputs((prev) => ({ ...prev, [momentId]: "" }));
        // 构建新的评论列表：旧评论 + 用户刚发的
        const newComments = [
          ...(moments.find((m) => m.id === momentId)?.comments || []),
          {
            id: data.id,
            user_id: getCurrentUserId(),
            is_user: true,
            companion_id: null,
            companion_name: "我",
            content: data.content,
            created_at: data.created_at,
          },
        ];
        // 后端可能返回 AI 自动回复
        if (data.ai_reply) {
          newComments.push(data.ai_reply);
        }
        // 更新该条动态的评论数和评论列表
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

  // ====================================================================
  // 根据 dynamic 的 companion_id 查找对应智能体信息（头像、名字、性别）
  // ====================================================================
  const getCompanionById = (id: string): Companion | undefined => {
    return companions.find((c) => c.id === id);
  };


  // ====================================================================
  // 首屏全局 loading：展示一个小型的加载指示器
  // ====================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
      </div>
    );
  }

  // ====================================================================
  // 主渲染
  // ====================================================================
  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background pb-24 overflow-y-auto mx-auto max-w-2xl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ═══════════════════ 下拉刷新提示条 ═══════════════════
           下拉时从顶部向下展开，高度=手指下拉距离，透明度渐变
           超过 80px 松手触发刷新                                     */}
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

      {/* ═══════════════════ 顶部标题栏 + 筛选/通知 ═══════════════════ */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl text-foreground">Moments</h1>
          <div className="flex items-center gap-3">
            {/* 筛选按钮：筛选激活时显示小粉点 */}
            <button
              type="button"
              className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              data-analytics-button="home-moment-filter"
              data-analytics-name="首页朋友圈筛选"
              onClick={() => {
                // 打开弹窗时，把当前生效的筛选值同步到草稿
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
            {/* 通知铃铛：点击记录已读时间，跳转通知页 */}
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

      {/* ═══════════════════ 智能体头像横滑条 ═══════════════════
           横向滚动（overflow-x-auto），包含"创建"按钮 + 已对话智能体      */}
      <div className="px-4 py-4 border-b border-border overflow-x-auto">
        <div className="flex gap-4">
          {/* 创建新智能体入口 */}
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
          {/* 已有智能体列表 */}
          {companions.map((companion) => (
            <button
              key={companion.id}
              onClick={() => navigate(`/companion/${companion.id}`)}
              className="flex-shrink-0 text-center"
              data-analytics-button={`home-companion-${companion.id}`}
              data-analytics-name={`首页进入伴侣-${companion.name}`}
            >
              <div className="relative mb-2">
                {/* 头像生成中 → 显示 spinner */}
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

      {/* ═══════════════════ 朋友圈动态列表 ═══════════════════ */}
      <div className="divide-y divide-border">
        {/* 空状态 */}
        {moments.length === 0 && (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            {t('home.noMoments')}
          </div>
        )}

        {/* 逐条渲染朋友圈动态 */}
        {moments.map((moment) => {
          // 通过 companion_id 匹配智能体信息
          const companion = getCompanionById(moment.companion_id);
          const displayName = moment.companion_name || companion?.name || t("home.defaultCompanionName");
          const displayGender = moment.companion_gender ?? companion?.gender;
          return (
            <div key={moment.id} className="bg-card">
              {/* ── 顶部：头像 + 名字 + 性别 + 时间 ── */}
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

              {/* ── 文案 ── */}
              <div className="px-4 pb-3">
                <p className="text-foreground text-sm">{moment.caption}</p>
              </div>

              {/* ── 图片 ── */}
              {moment.image_generating ? (
                // 图片还在生成中 → 占位符 + spinner
                <div className="w-full aspect-square bg-muted flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="text-muted-foreground text-sm">图片生成中...</span>
                </div>
              ) : (
                // 图片已就绪 → 点击可全屏预览
                <MomentImage
                  src={moment.image_url}
                  alt="moment"
                  className="w-full aspect-square object-cover cursor-pointer"
                  onClick={() => setPreviewImage(moment.image_url)}
                />
              )}

              {/* ── 操作栏：点赞 + 评论按钮 + 评论列表 + 评论输入框 ── */}
              <div className="px-4 py-3">
                {/* 点赞 & 评论按钮 */}
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

                {/* 评论列表 */}
                {moment.comments && moment.comments.length > 0 && (
                  <div className="mt-3 space-y-2 bg-muted/30 rounded-lg p-3">
                    {moment.comments.map((comment) => (
                      <div key={comment.id} className="text-xs">
                        {/* 评论者名字：用户=粉色，智能体=主色 */}
                        <span
                          className={`font-medium mr-1 ${
                            isCommentByMe(comment.user_id) ? "text-pink-500" : "text-primary"
                          }`}
                        >
                          {comment.companion_name}
                        </span>
                        <span className="text-foreground/80 break-words">
                          {/* 回复某人时显示 @xxx */}
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

                {/* 评论输入框 */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    id={`home-moment-comment-${moment.id}`}
                    name={`moment_comment_${moment.id}`}
                    type="text"
                    autoComplete="off"
                    disabled={commentLoading[moment.id]}
                    value={commentInputs[moment.id] || ""}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({
                        ...prev,
                        [moment.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !commentLoading[moment.id]) {
                        e.preventDefault();
                        handleComment(moment.id);
                      }
                    }}
                    placeholder={commentLoading[moment.id] ? t('common.loading') : t('home.writeComment')}
                    className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleComment(moment.id)}
                    disabled={commentLoading[moment.id] || !commentInputs[moment.id]?.trim()}
                    className="p-2 text-primary disabled:text-muted-foreground"
                    data-analytics-button="home-send-comment"
                    data-analytics-name="首页发送评论"
                  >
                    {commentLoading[moment.id] ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* ═══════════════════ 底部哨兵 + 加载状态 ═══════════════════ */}
        <div ref={loadMoreRef} className="py-4 text-center">
          {/* 加载更多中 → spinner */}
          {loadingMore && (
            <div className="text-muted-foreground text-sm flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('common.loading')}
            </div>
          )}
          {/* 没有更多了 */}
          {!hasMore && moments.length > 0 && (
            <div className="text-muted-foreground text-xs">{t("home.noMoreMoments")}</div>
          )}
        </div>
      </div>

      {/* ═══════════════════ 回到顶部按钮（固定悬浮右下角） ═══════════════════ */}
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

      {/* ═══════════════════ 筛选弹窗（模态层） ═══════════════════ */}
      {showMomentFilter && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => setShowMomentFilter(false)}  // 点击蒙层关闭
        >
          {/* 弹窗主体：移动端从底部弹出，PC 居中；底部留白防止被导航栏遮挡 */}
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto pb-24 sm:pb-6"
            onClick={(e) => e.stopPropagation()}   // 阻止冒泡到蒙层
          >
            {/* 标题 + 关闭按钮 */}
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

            {/* 筛选选项 */}
            <div className="space-y-4">
              {/* 语言筛选 */}
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t("home.filterLanguage")}</label>
                <select
                  value={draftFilterLang}
                  onChange={(e) => setDraftFilterLang(e.target.value)}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-0"
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
              {/* 性别筛选 */}
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
              {/* 性取向筛选 */}
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

            {/* 底部操作按钮：重置 / 应用 */}
            <div className="flex gap-2 mt-6">
              {/* 重置：只清空弹窗内草稿表单，不触发数据加载 */}
              <button
                type="button"
                className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors"
                onClick={() => {
                  setDraftFilterLang("");
                  setDraftFilterGender("");
                  setDraftFilterOrientation("");
                }}
              >
                {t("home.resetFilter")}
              </button>
              {/* 应用：把草稿值同步到生效值 → 刷新朋友圈 */}
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

      {/* ═══════════════════ 图片全屏预览 ═══════════════════
           点击图片 → 全屏黑色遮罩 + 大图 + 关闭按钮                     */}
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
            onClick={(e) => e?.stopPropagation()}   // 点击图片不关闭
          />
        </div>
      )}

      {/* ═══════════════════ 底部导航栏 ═══════════════════ */}
      <TabBar />
    </div>
  );
}
