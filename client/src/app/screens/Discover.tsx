import { TabBar } from "../components/TabBar";
import { AvatarImage } from "../components/AvatarImage";
import {
  Search,
  MessageSquare,
  Heart,
  Plus,
  X,
  Send,
  ChevronRight,
  User,
  Bot,
  Sparkles,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { sortCompanionsByUserLang } from "../utils/companionLang";
import { formatAffectionDisplay } from "../utils/formatAffection";
import { normalizeMediaUrl } from "../utils/media";
import apiFetch from "../utils/api";

interface PostItem {
  id: number;
  user_id: number | null;
  user_name: string;
  avatar: string;
  title: string;
  content: string;
  images: string[];
  category: string;
  likes_count: number;
  comments_count: number;
  liked: boolean;
  created_at: string;
}

const POST_CATEGORIES = [
  { key: "", label: "discover.catAll" },
  { key: "dating", label: "discover.catDating" },
  { key: "psychology", label: "discover.catPsychology" },
  { key: "tips", label: "discover.catTips" },
  { key: "story", label: "discover.catStory" },
  { key: "offtopic", label: "discover.catOfftopic" },
];

function formatRelativeTime(isoTime: string, t: (k: string, o?: any) => string): string {
  if (!isoTime) return "";
  const date = new Date(isoTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t("discover.justNow");
  if (diffMin < 60) return t("discover.minutesAgo", { count: diffMin });
  if (diffHour < 24) return t("discover.hoursAgo", { count: diffHour });
  if (diffDay < 7) return t("discover.daysAgo", { count: diffDay });
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

interface CompanionItem {
  profile: {
    id: string;
    name: string;
    age: number;
    gender: string;
    city: string;
    personality: string;
    mbti: string;
    language?: string;
  };
  state: {
    affection: number;
    turns: number;
  };
  avatar: string;
}

export function Discover() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newImages, setNewImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [activeTab, setActiveTab] = useState<"posts" | "companions">("posts");
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [companionFilter, setCompanionFilter] = useState<"all" | "recommended">("all");
  const [companionsLoading, setCompanionsLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PostItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const getDeviceId = () => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("device_id", id);
    }
    return id;
  };
  const deviceId = getDeviceId();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeCategory
        ? `/api/posts?limit=50&category=${encodeURIComponent(activeCategory)}`
        : "/api/posts?limit=50";
      const data = await apiFetch(url, { headers: { "x-device-id": deviceId } });
      setPosts(data.posts || []);
    } catch (err) {
      console.error("加载帖子失败:", err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, activeCategory]);

  const fetchCompanions = useCallback(async () => {
    setCompanionsLoading(true);
    try {
      const data = await apiFetch("/companions");
      const userLang = i18n.language || "zh";
      const sorted = sortCompanionsByUserLang(data || [], userLang);
      setCompanions(sorted);
    } catch (err) {
      console.error("加载智能体列表失败:", err);
    } finally {
      setCompanionsLoading(false);
    }
  }, [i18n.language]);

  useEffect(() => {
    if (activeTab === "posts") {
      fetchPosts();
    } else {
      fetchCompanions();
    }
  }, [activeTab, fetchPosts, fetchCompanions]);

  useEffect(() => {
    setSearchQuery("");
  }, [activeCategory]);

  const handleCreatePost = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) return;
    setCreating(true);
    try {
      await apiFetch("/api/posts", {
        method: "POST",
        headers: { "x-device-id": deviceId },
        body: JSON.stringify({ title, content, category: newCategory, images: newImages }),
      });
      setNewTitle("");
      setNewContent("");
      setNewCategory("");
      setNewImages([]);
      setShowCreate(false);
      fetchPosts();
    } catch {
      // apiFetch 内部已统一处理错误和401
    } finally {
      setCreating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (newImages.length + files.length > 9) {
      alert(t("discover.maxImages") || "最多上传 9 张图片");
      return;
    }
    setUploadingImages(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const token = localStorage.getItem("user_token");
        const uploadHeaders: Record<string, string> = {};
        if (token) uploadHeaders["x-token"] = token;
        const res = await fetch("/api/upload/image", {
          method: "POST",
          headers: uploadHeaders,
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploadedUrls.push(data.url);
        }
      }
      setNewImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      console.error("图片上传失败:", err);
      alert(t("discover.imageUploadFailed") || "图片上传失败");
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLike = async (postId: number) => {
    try {
      const data = await apiFetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
      if (data.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, liked: data.liked, likes_count: data.likes_count }
              : p
          )
        );
        setSearchResults((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, liked: data.liked, likes_count: data.likes_count }
              : p
          )
        );
      }
    } catch (e) {
      console.error("点赞失败:", e);
    }
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiFetch(
          `/api/posts/search?q=${encodeURIComponent(query)}&limit=50`,
          { headers: { "x-device-id": deviceId } }
        );
        setSearchResults(data.posts || []);
      } catch (err) {
        console.error("搜索失败:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, deviceId]);

  const displayPosts = searchQuery.trim() ? searchResults : posts;
  const isSearchLoading = searchQuery.trim() && searchLoading;

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
      setRefreshing(true);
      setPullDistance(0);
      Promise.all([fetchPosts(), fetchCompanions()]).then(() => {
        setRefreshing(false);
      });
    } else {
      setPullDistance(0);
    }
  };

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
          {t('common.loading')}
        </div>
      )}
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl text-foreground">{t("discover.title")}</h1>
          {activeTab === "posts" && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 active:scale-95 transition-transform"
              data-analytics-button="discover-create-post"
              data-analytics-name="发现页发布帖子"
            >
              <Plus className="w-4 h-4" />
              {t("discover.newPost")}
            </button>
          )}
        </div>

        {/* 栏目切换：帖子 / 机器人 */}
        <div className="flex bg-secondary rounded-xl p-1 mb-3">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "posts"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            data-analytics-button="discover-tab-posts"
            data-analytics-name="发现页切换帖子Tab"
          >
            <MessageSquare className="w-4 h-4" />
            {t("discover.tabPosts")}
          </button>
          <button
            onClick={() => setActiveTab("companions")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "companions"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            data-analytics-button="discover-tab-companions"
            data-analytics-name="发现页切换伴侣Tab"
          >
            <Bot className="w-4 h-4" />
            {t("discover.tabCompanions")}
          </button>
        </div>

        {activeTab === "posts" && (
          <>
            <div className="bg-secondary rounded-full px-4 py-2 flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("discover.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 py-2 scrollbar-hide">
              {POST_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {t(cat.label)}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === "companions" && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCompanionFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                companionFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground border border-border"
              }`}
            >
              {t("discover.filterAll")}
            </button>
            <button
              onClick={() => setCompanionFilter("recommended")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                companionFilter === "recommended"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground border border-border"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {t("discover.filterRecommended")}
            </button>
          </div>
        )}
      </div>

      {activeTab === "posts" ? (
        /* Posts List 帖子列表 */
        <div className="px-4 py-4 space-y-4">
          {isSearchLoading || loading ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
            </div>
          ) : displayPosts.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {searchQuery ? t("discover.noSearchResults") : t("discover.noPosts")}
              </p>
            </div>
          ) : (
            displayPosts.map((post: PostItem) => (
              <div
                key={post.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Author 作者 */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {post.avatar ? (
                      <AvatarImage src={post.avatar} seed={post.user_id || "user"} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">
                      {post.user_name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeTime(post.created_at, t)}
                    </p>
                  </div>
                </div>

                {/* Content 内容 */}
                <button
                  onClick={() => navigate(`/discover/post/${post.id}`)}
                  className="w-full text-left px-4 pb-3"
                >
                  {post.category && (
                    <span className="inline-block mb-1.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {t(`discover.cat_${post.category}`) || post.category}
                    </span>
                  )}
                  <h3 className="text-foreground font-medium text-base mb-1 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-3">
                    {post.content}
                  </p>
                </button>

                {/* Images preview */}
                {post.images && post.images.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex gap-2 overflow-x-auto">
                      {post.images.slice(0, 3).map((img: string, idx: number) => (
                        <img
                          key={idx}
                          src={normalizeMediaUrl(img) || undefined}
                          alt=""
                          className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pWw5o2u5aSE55CG6ZSZ6K+vPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions 操作 */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(post.id);
                      }}
                      className="flex items-center gap-1.5 text-sm"
                      data-analytics-button="discover-post-like"
                      data-analytics-name="发现页帖子点赞"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          post.liked ? "fill-pink-500 text-pink-500" : "text-muted-foreground"
                        }`}
                      />
                      <span className={post.liked ? "text-pink-500" : "text-muted-foreground"}>
                        {post.likes_count || 0}
                      </span>
                    </button>
                    <button
                      onClick={() => navigate(`/discover/post/${post.id}`)}
                      className="flex items-center gap-1.5 text-sm"
                      data-analytics-button="discover-post-comment"
                      data-analytics-name="发现页帖子评论"
                    >
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{post.comments_count || 0}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => navigate(`/discover/post/${post.id}`)}
                    className="text-primary text-sm font-medium flex items-center gap-0.5"
                    data-analytics-button="discover-view-detail"
                    data-analytics-name="发现页查看帖子详情"
                  >
                    {t("discover.viewDetail")}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Companions List */
        <div className="px-4 py-4 space-y-4">
          {companionsLoading ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
            </div>
          ) : (() => {
            const uiLang = (i18n.language || "zh").split("-")[0];
            const list =
              companionFilter === "recommended"
                ? [...companions]
                    .sort((a, b) => {
                      const ma =
                        (a.profile.language || "").split("-")[0] === uiLang ? 1 : 0;
                      const mb =
                        (b.profile.language || "").split("-")[0] === uiLang ? 1 : 0;
                      if (mb !== ma) return mb - ma;
                      return (b.state.turns || 0) - (a.state.turns || 0);
                    })
                    .slice(0, 10)
                : companions;
            if (list.length === 0) {
              return (
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">{t("discover.noCompanions")}</p>
                </div>
              );
            }
            return list.map((c) => {
              const personalities = c.profile.personality
                ? c.profile.personality.split(/[、,，]/).filter(Boolean).slice(0, 3)
                : [];
              return (
                <div
                  key={c.profile.id}
                  onClick={() => navigate(`/companion/${c.profile.id}`)}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <AvatarImage
                    src={c.avatar}
                    seed={c.profile.id}
                    alt={c.profile.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-foreground font-medium text-base truncate">
                        {c.profile.name}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {c.profile.age}{t("companionProfile.ageUnit")} · {c.profile.gender}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs mb-2 truncate">
                      {c.profile.city}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {personalities.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs"
                        >
                          {p.trim()}
                        </span>
                      ))}
                      {c.profile.mbti && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-xs">
                          {c.profile.mbti}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="bg-pink-500 text-white px-2.5 py-1 rounded-full text-xs font-medium">
                      {formatAffectionDisplay(c.state.affection)}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      <TabBar />

      {/* Create Post Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-foreground font-medium">{t("discover.createPost")}</h2>
              <button onClick={() => { setShowCreate(false); setNewImages([]); }} data-analytics-button="discover-close-create" data-analytics-name="发现页关闭发帖弹窗">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-foreground text-sm mb-1.5 block">
                  {t("discover.postCategory")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {POST_CATEGORIES.filter((c) => c.key !== "").map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setNewCategory(cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        newCategory === cat.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground border border-border"
                      }`}
                    >
                      {t(cat.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-foreground text-sm mb-1.5 block">
                  {t("discover.postTitle")}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t("discover.titlePlaceholder")}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-1.5 block">
                  {t("discover.postContent")}
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={t("discover.contentPlaceholder")}
                  rows={6}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                  maxLength={5000}
                />
                <p className="text-right text-xs text-muted-foreground mt-1">
                  {newContent.length}/5000
                </p>
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-foreground text-sm mb-1.5 block">
                  {t("discover.postImages") || "图片"}
                  <span className="text-muted-foreground text-xs ml-1">
                    ({newImages.length}/9)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {newImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <img
                        src={normalizeMediaUrl(img) || undefined}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pWw5o2u5aSE55CG6ZSZ6K+vPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {newImages.length < 9 && (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors flex-shrink-0">
                      {uploadingImages ? (
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">{t("discover.addImage") || "添加"}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImages}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={handleCreatePost}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
                data-analytics-button="discover-publish-post"
                data-analytics-name="发现页确认发布帖子"
                className="w-full bg-primary text-primary-foreground py-3 rounded-full font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>{t("discover.publishing")}</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("discover.publish")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
