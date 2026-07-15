import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { AvatarImage } from "../components/AvatarImage";
import { normalizeMediaUrl } from "../utils/media";
import { ArrowLeft, MessageSquare, Heart, Trash2, User } from "lucide-react";

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

export function MyPosts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyPosts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("user_token");
      if (!token) {
        setPosts([]);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/posts/my", {
        headers: { "x-token": token },
      });
      if (res.status === 401) {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_info");
        setPosts([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error("加载我的帖子失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  const handleDelete = async (postId: number) => {
    if (!confirm(t("common.confirm"))) return;
    try {
      const token = localStorage.getItem("user_token");
      if (!token) return;
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { "x-token": token },
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        alert(t("common.failed"));
      }
    } catch (e) {
      console.error("删除帖子失败:", e);
      alert(t("common.networkError"));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl text-foreground">{t("profile.myMoments")}</h1>
        </div>
      </div>

      {/* Posts List */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t("discover.noPosts")}</p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              {/* Author */}
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
                <button
                  onClick={() => handleDelete(post.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
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
                    {post.images.slice(0, 3).map((img, idx) => (
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

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 py-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-sm">
                  <Heart className={`w-4 h-4 ${post.liked ? "text-pink-500 fill-pink-500" : "text-muted-foreground"}`} />
                  <span className={post.liked ? "text-pink-500" : "text-muted-foreground"}>{post.likes_count || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{post.comments_count || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
