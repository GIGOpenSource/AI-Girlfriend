import { useState, useEffect, useCallback, useMemo } from "react";
import { AvatarImage } from "../components/AvatarImage";
import { TabBar } from "../components/TabBar";
import { Search, Plus, MessageSquare, X, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { useChat } from "../context/ChatContext";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "../utils/authHeaders";

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  rawTime: string;
  unread: number;
  avatar_generating?: boolean;
}

export function Messages() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const formatRelativeTime = useCallback((isoTime: string) => {
    if (!isoTime) return "";
    const date = new Date(isoTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return t('messages.justNow') as string;
    if (diffMin < 60) return t('messages.minutesAgo', { count: diffMin } as any) as string;
    if (diffHour < 24) return t('messages.hoursAgo', { count: diffHour } as any) as string;
    if (diffDay === 1) return t('messages.yesterday') as string;
    if (diffDay < 7) return t('messages.daysAgo', { count: diffDay } as any) as string;
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }, [t]);

  const { unreadCounts, lastMessages, typingCompanions, connect } = useChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawCompanions, setRawCompanions] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConversations = useCallback(() => {
    fetch("/companions", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        // 只展示有过对话的智能体（turns > 0 或有最后一条消息）
        const hasChat = (data || []).filter(
          (c: any) => c.state?.turns > 0 || c.last_message
        );
        const MAX_BACKGROUND_WS = 12;
        const scored = [...hasChat].sort((a: any, b: any) => {
          const ta = new Date(a.last_message_time || 0).getTime();
          const tb = new Date(b.last_message_time || 0).getTime();
          return tb - ta;
        });
        scored.slice(0, MAX_BACKGROUND_WS).forEach((c: any, idx: number) => {
          const id = c.profile?.id || c.id;
          if (!id) return;
          window.setTimeout(() => connect(id), idx * 60);
        });
        setRawCompanions(hasChat);
      })
      .catch((err) => {
        console.error("加载消息列表失败:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [connect]);

  // 组件挂载时加载
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 页面回到前台时刷新列表（新建 companion 后返回能看到）
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        loadConversations();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadConversations]);

  // 根据未读数、最后消息、typing 状态的变化更新列表（不重新 fetch）
  useEffect(() => {
    if (rawCompanions.length === 0) return;

    const list: Conversation[] = rawCompanions.map((c: any) => {
      const id = c.profile?.id || "";
      const lastMsg = lastMessages[id];
      return {
        id,
        name: c.profile?.name || t('chat.defaultName'),
        avatar:
          c.avatar ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profile?.id}`,
        lastMessage: lastMsg?.text || c.last_message || "",
        time: lastMsg?.fullTime
          ? formatRelativeTime(lastMsg.fullTime)
          : formatRelativeTime(c.last_message_time),
        rawTime: lastMsg?.fullTime || c.last_message_time || "",
        unread: unreadCounts[id] || 0,
        avatar_generating: c.avatar_generating,
      };
    });

    // 排序：未读数降序 > 最近消息时间倒序 > 其他
    list.sort((a, b) => {
      // 1. 未读数多的优先
      if (b.unread !== a.unread) return b.unread - a.unread;
      // 2. 有最近消息的优先（按时间倒序）
      const aTime = a.rawTime ? new Date(a.rawTime).getTime() : 0;
      const bTime = b.rawTime ? new Date(b.rawTime).getTime() : 0;
      return bTime - aTime;
    });

    setConversations(list);
  }, [rawCompanions, unreadCounts, lastMessages, formatRelativeTime, t]);

  const handleOpenChat = (id: string) => {
    connect(id);
    navigate(`/chat/${id}`);
  };

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage || "").toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl text-foreground">{t("messages.title")}</h1>
          <button
            onClick={() => setShowMenu(true)}
            className="p-2"
            data-analytics-button="messages-menu"
            data-analytics-name="消息页打开菜单"
          >
            <Plus className="w-6 h-6 text-foreground" />
          </button>
        </div>

        <div className="bg-secondary rounded-full px-4 py-2 flex items-center gap-2">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('messages.searchPlaceholder')}
            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none"
            aria-label={t("messages.searchPlaceholder")}
          />
        </div>
      </div>

      {/* 置顶：意见反馈入口 */}
      <div className="px-4 py-3 border-b border-border">
        <button
          onClick={() => {
            const token = localStorage.getItem("user_token");
            if (!token) {
              alert(t('messages.loginRequiredFeedback'));
              navigate("/");
              return;
            }
            navigate("/feedback");
          }}
          className="w-full flex items-center gap-3 hover:bg-secondary/50 transition-colors active:bg-secondary px-2 py-2 rounded-lg"
          data-analytics-button="messages-feedback"
          data-analytics-name="消息页意见反馈"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between mb-1">
              <p className="text-foreground font-medium">{t('messages.feedback')}</p>
            </div>
            <p className="text-muted-foreground text-sm truncate">
              {t('messages.feedbackDesc')}
            </p>
          </div>
        </button>
      </div>

      <div className="divide-y divide-border">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            {t('common.loading')}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm mb-2">{t('messages.noMessages')}</p>
            <p className="text-xs">{t('messages.createCompanionHint')}</p>
          </div>
        )}
        {!loading &&
          conversations.length > 0 &&
          filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground text-sm text-center">
              {t("messages.searchNoResults")}
            </div>
          )}
        {filteredConversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => handleOpenChat(conv.id)}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors active:bg-secondary"
            data-analytics-button={`messages-open-chat-${conv.id}`}
            data-analytics-name={`消息页打开聊天-${conv.name}`}
          >
            <div className="relative flex-shrink-0">
              {conv.avatar_generating ? (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
                </div>
              ) : (
                <AvatarImage
                  src={conv.avatar}
                  seed={conv.id}
                  alt={conv.name}
                  className="w-14 h-14 rounded-full object-cover"
                />
              )}
              {conv.unread > 0 && (
                <div className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {conv.unread}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between mb-1">
                <p className="text-foreground">{conv.name}</p>
                <span className="text-muted-foreground text-xs">{conv.time}</span>
              </div>
              {typingCompanions[conv.id] ? (
                <p className="text-pink-500 text-sm truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></span>
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></span>
                  {t('messages.typing')}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm truncate">
                  {conv.lastMessage || t('messages.noMessageYet')}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <TabBar />

      {/* 弹出菜单 */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="bg-card w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-4 space-y-2 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-foreground font-medium">{t('messages.chooseAction')}</h3>
              <button onClick={() => setShowMenu(false)} className="p-1" data-analytics-button="messages-close-menu" data-analytics-name="消息页关闭菜单">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <button
              onClick={() => {
                setShowMenu(false);
                navigate("/create");
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
              data-analytics-button="messages-create-companion"
              data-analytics-name="消息页创建伴侣"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-foreground font-medium">{t('home.create')}</p>
                <p className="text-muted-foreground text-xs">{t('messages.createCompanionHint')}</p>
              </div>
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                navigate("/my-companions");
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
              data-analytics-button="messages-my-companions"
              data-analytics-name="消息页我的伴侣"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-foreground font-medium">{t('messages.viewAllCompanions')}</p>
                <p className="text-muted-foreground text-xs">{t('messages.allCompanionsDesc')}</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
