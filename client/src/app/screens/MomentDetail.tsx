import { useParams, useNavigate } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { AvatarImage } from "../components/AvatarImage";
import { MomentImage } from "../components/MomentImage";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import apiFetch from "../utils/api";

interface MomentDetailData {
  id: number;
  companion_id: string;
  companion_name: string;
  companion_avatar: string;
  companion_gender?: string;
  image_url: string;
  image_generating?: boolean;
  caption: string;
  likes_count: number;
  comments_count: number;
  liked: boolean;
  created_at: string;
  comments: MomentComment[];
}

interface MomentComment {
  id: number;
  user_id?: number | null;
  is_user: boolean;
  companion_id: string | null;
  companion_name: string;
  content: string;
  created_at: string;
  parent_id?: number | null;
  reply_to_name?: string | null;
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

  if (diffSec < 60) return t("home.justNow");
  if (diffMin < 60) return t("home.minutesAgo", { count: diffMin });
  if (diffHour < 24) return t("home.hoursAgo", { count: diffHour });
  if (diffDay < 7) return t("home.daysAgo", { count: diffDay });
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
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

export function MomentDetail() {
  const { momentId } = useParams<{ momentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [moment, setMoment] = useState<MomentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MomentComment | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const deviceId = localStorage.getItem("device_id") || "anonymous";

  const fetchMoment = useCallback(async () => {
    if (!momentId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/moments/${momentId}`, {
        headers: { "x-device-id": deviceId },
      });
      setMoment(data);
    } catch (err) {
      console.error("加载朋友圈失败:", err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, momentId, navigate]);

  useEffect(() => {
    fetchMoment();
  }, [fetchMoment]);

  const handleLike = async () => {
    if (!moment) return;
    try {
      const data = await apiFetch(`/api/moments/${moment.id}/like`, {
        method: "POST",
        headers: { "x-device-id": deviceId },
      });
      if (data.ok) {
        setMoment((prev) =>
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
    if (!content || !moment) return;
    setSending(true);
    try {
      const body: { content: string; parent_id?: number } = { content };
      if (replyTo) {
        body.parent_id = replyTo.id;
      }
      await apiFetch(`/api/moments/${moment.id}/comment`, {
        method: "POST",
        headers: { "x-device-id": deviceId },
        body: JSON.stringify(body),
      });
      setCommentText("");
      setReplyTo(null);
      fetchMoment();
    } catch {
      // apiFetch 内部已统一处理错误和401
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

  if (!moment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">朋友圈不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg text-foreground font-medium truncate flex-1">
          朋友圈详情
        </h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Moment Content */}
        <div className="bg-card border-b border-border px-4 py-4">
          {/* Author */}
          <div className="flex items-center gap-3 mb-3">
            <AvatarImage
              src={moment.companion_avatar}
              seed={moment.companion_id}
              alt={moment.companion_name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <div className="flex items-center gap-1">
                <p className="text-foreground text-sm font-medium">
                  {moment.companion_name}
                </p>
                {moment.companion_gender === "男" && (
                  <span className="text-blue-400 text-xs">♂</span>
                )}
                {moment.companion_gender === "女" && (
                  <span className="text-pink-400 text-xs">♀</span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {formatRelativeTime(moment.created_at, t)}
              </p>
            </div>
          </div>

          {/* Caption */}
          <p className="text-foreground text-sm leading-relaxed mb-3">
            {moment.caption}
          </p>

          {/* Image */}
          {moment.image_generating ? (
            <div className="w-full aspect-square bg-muted flex flex-col items-center justify-center gap-3 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="text-muted-foreground text-sm">图片生成中...</span>
            </div>
          ) : moment.image_url ? (
            <MomentImage
              src={moment.image_url}
              alt="moment"
              className="w-full aspect-square object-cover rounded-lg cursor-pointer"
              onClick={() => setPreviewImage(moment.image_url)}
            />
          ) : null}

          {/* Actions */}
          <div className="flex items-center gap-5 pt-3">
            <button onClick={handleLike} className="flex items-center gap-1.5">
              <Heart
                className={`w-5 h-5 ${
                  moment.liked ? "fill-pink-500 text-pink-500" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-sm ${
                  moment.liked ? "text-pink-500" : "text-muted-foreground"
                }`}
              >
                {moment.likes_count || 0}
              </span>
            </button>
            <button
              onClick={() => commentInputRef.current?.focus()}
              className="flex items-center gap-1.5"
            >
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {moment.comments_count || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="px-4 py-4">
          <h3 className="text-foreground font-medium text-sm mb-4">
            评论 ({moment.comments_count || 0})
          </h3>

          {moment.comments && moment.comments.length > 0 ? (
            <div className="space-y-3">
              {moment.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3"
                  onClick={() => {
                    setReplyTo(comment);
                    commentInputRef.current?.focus();
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0 text-xs font-medium">
                    {isCommentByMe(comment.user_id) ? "我" : comment.companion_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-secondary/50 rounded-xl px-3 py-2">
                      <p
                        className={`text-xs font-medium mb-0.5 ${
                          isCommentByMe(comment.user_id) ? "text-pink-500" : "text-primary"
                        }`}
                      >
                        {comment.companion_name}
                      </p>
                      <p className="text-foreground text-sm">
                        {comment.reply_to_name && (
                          <span className="text-primary font-medium">
                            @{comment.reply_to_name}{" "}
                          </span>
                        )}
                        {comment.content}
                      </p>
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
              <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">暂无评论，来抢沙发吧</p>
            </div>
          )}
        </div>
      </div>

      {/* Comment Input */}
      <div className="bg-card border-t border-border px-4 py-3 sticky bottom-0">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-muted-foreground">
              回复 <span className="text-primary font-medium">{replyTo.companion_name}</span>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              取消回复
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            ref={commentInputRef}
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
            placeholder={replyTo ? `回复 ${replyTo.companion_name}...` : "写评论..."}
            className="flex-1 bg-secondary border border-border rounded-full px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            maxLength={200}
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

      {/* Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <MomentImage
            src={previewImage}
            alt="preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e?.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
