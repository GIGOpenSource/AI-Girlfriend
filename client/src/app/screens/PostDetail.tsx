import { useParams, useNavigate } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { AvatarImage } from "../components/AvatarImage";
import { normalizeMediaUrl } from "../utils/media";
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Send,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface PostDetailData {
  id: number;
  user_id: number | null;
  user_name: string;
  avatar: string;
  title: string;
  content: string;
  images: string[];
  likes_count: number;
  comments_count: number;
  liked: boolean;
  created_at: string;
  comments: PostComment[];
}

interface PostComment {
  id: number;
  user_id: number | null;
  user_name: string;
  avatar?: string;
  content: string;
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

export function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [post, setPost] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const getDeviceId = () => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("device_id", id);
    }
    return id;
  };
  const deviceId = getDeviceId();

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("user_token");
      const headers: Record<string, string> = {
        "x-device-id": deviceId,
      };
      if (token) headers["x-token"] = token;
      const res = await fetch(`/api/posts/${postId}`, { headers });
      if (res.status === 401) {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_info");
        navigate("/discover");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      } else {
        navigate("/discover");
      }
    } catch (err) {
      console.error("加载帖子失败:", err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, navigate, postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleLike = async () => {
    if (!post) return;
    try {
      const token = localStorage.getItem("user_token");
      const headers: Record<string, string> = {
        "x-device-id": deviceId,
      };
      if (token) headers["x-token"] = token;
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
        headers,
      });
      if (res.status === 401) {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_info");
        return;
      }
      const data = await res.json();
      if (data.ok) {
        setPost((prev) =>
          prev
            ? { ...prev, liked: data.liked, likes_count: data.likes_count }
            : prev
        );
      }
    } catch (e) {
      console.error("点赞失败:", e);
    }
  };

  const handleSendComment = async () => {
    const content = commentText.trim();
    if (!content || !post) return;
    setSending(true);
    try {
      const token = localStorage.getItem("user_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
      };
      if (token) headers["x-token"] = token;
      const res = await fetch(`/api/posts/${post.id}/comment`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content }),
      });
      if (res.status === 401) {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_info");
        alert(t("discover.loginExpired"));
        return;
      }
      if (res.ok) {
        setCommentText("");
        fetchPost();
      } else {
        const data = await res.json();
        alert(data.detail || t("discover.commentFailed"));
      }
    } catch (err) {
      console.error(err);
      alert(t("common.networkError"));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t("discover.postNotFound")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate("/discover")} className="p-1">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg text-foreground font-medium truncate flex-1">
          {t("discover.postDetail")}
        </h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Post Content */}
        <div className="bg-card border-b border-border px-4 py-5">
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
              {post.avatar ? (
                <AvatarImage src={post.avatar} seed={post.user_id || "user"} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-foreground text-sm font-medium">{post.user_name}</p>
              <p className="text-muted-foreground text-xs">
                {formatRelativeTime(post.created_at, t)}
              </p>
            </div>
          </div>

          {/* Title & Content */}
          <h2 className="text-foreground text-lg font-semibold mb-3">{post.title}</h2>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mb-4">
            {post.content}
          </p>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className="space-y-2 mb-4">
              {post.images.map((img, idx) => (
                <img
                  key={idx}
                  src={normalizeMediaUrl(img) || undefined}
                  alt=""
                  className="w-full rounded-xl object-cover max-h-80"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9veWksei0pTwvdGV4dPjwvc3ZnPg==';
                  }}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-5 pt-2">
            <button onClick={handleLike} className="flex items-center gap-1.5">
              <Heart
                className={`w-5 h-5 ${
                  post.liked ? "fill-pink-500 text-pink-500" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-sm ${
                  post.liked ? "text-pink-500" : "text-muted-foreground"
                }`}
              >
                {post.likes_count || 0}
              </span>
            </button>
            <button
              onClick={() => commentInputRef.current?.focus()}
              className="flex items-center gap-1.5"
            >
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{post.comments_count || 0}</span>
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="px-4 py-4">
          <h3 className="text-foreground font-medium text-sm mb-4">
            {t("discover.comments")} ({post.comments_count || 0})
          </h3>

          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-4">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0 overflow-hidden">
                    {comment.avatar ? (
                      <AvatarImage src={comment.avatar} seed={comment.user_id || "user"} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-secondary/50 rounded-xl px-3 py-2">
                      <p className="text-foreground text-xs font-medium mb-0.5">
                        {comment.user_name}
                      </p>
                      <p className="text-foreground text-sm">{comment.content}</p>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1 ml-1">
                      {formatRelativeTime(comment.created_at, t)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">{t("discover.noComments")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Comment Input */}
      <div className="bg-card border-t border-border px-4 py-3 flex items-center gap-3 sticky bottom-0">
        <input
          ref={commentInputRef}
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
          placeholder={t("discover.commentPlaceholder")}
          className="flex-1 bg-secondary border border-border rounded-full px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          maxLength={500}
        />
        <button
          onClick={handleSendComment}
          disabled={sending || !commentText.trim()}
          className="bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
