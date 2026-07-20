import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, MoreVertical, Smile, Send } from "lucide-react";
import { useChat } from "../context/ChatContext";
import { useTranslation } from "react-i18next";
import { AvatarImage } from "../components/AvatarImage";
import type { ChatMessage } from "../context/ChatContext";
import { getAuthHeaders } from "../utils/authHeaders";
import {
  formatMessageTime,
  formatChatDateSeparator,
  calendarDayKeyFromIso,
} from "../utils/chatTime";
import { isWsConnectWelcomeNotice } from "../utils/chatConnectNotice";

interface CompanionInfo {
  name: string;
  avatar: string;
  online: boolean;
}

const CHAT_GROUP_GAP_MIN = 4;

function isConvSender(s: ChatMessage["sender"]): boolean {
  return s === "user" || s === "ai";
}

function breaksConversationGroup(s: ChatMessage["sender"]): boolean {
  return s === "system" || s === "thinking" || s === "filler";
}

function messageInstant(m: ChatMessage): number {
  if (m.ts) {
    const t = Date.parse(m.ts);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

type BubbleClusterLayout = {
  groupWithPrev: boolean;
  groupWithNext: boolean;
  showAvatar: boolean;
  avatarSpacer: boolean;
  showFootTime: boolean;
};

// Memoized 单条消息气泡 - 防止列表重渲染时所有消息都重新渲染
const MessageBubble = memo(({ message, companion, companionId, handleCopyMessage, dismissMessage, t, layout }: {
  message: ChatMessage;
  companion: CompanionInfo;
  companionId?: string;
  handleCopyMessage: (text: string) => void;
  dismissMessage: (id: number) => void;
  t: any;
  layout?: BubbleClusterLayout;
}) => {
  if (message.sender === "thinking") {
    return (
      <div className="flex justify-center px-2">
        <button
          type="button"
          onClick={() => dismissMessage(message.id)}
          title={t("chat.thinkingDismissHint")}
          className="max-w-[90%] rounded-xl px-3 py-2 bg-muted/60 text-muted-foreground text-xs text-center whitespace-pre-wrap break-words border border-border/50 cursor-pointer hover:bg-muted/80 active:opacity-90 transition-all duration-300 ease-out animate-in fade-in zoom-in-95 duration-300"
        >
          {message.text}
        </button>
      </div>
    );
  }
  if (message.sender === "filler") {
    return (
      <div className="flex justify-center px-2">
        <div
          className="max-w-[90%] rounded-lg px-3 py-1.5 bg-primary/5 text-primary/80 text-xs text-center whitespace-pre-wrap break-words border border-primary/10 italic animate-in fade-in slide-in-from-bottom-1 duration-300"
          role="status"
        >
          {message.text}
        </div>
      </div>
    );
  }
  if (message.sender === "system") {
    return (
      <div className="flex justify-center px-2">
        <div className="max-w-[90%] rounded-xl px-3 py-2 bg-muted/60 text-muted-foreground text-xs text-center whitespace-pre-wrap break-words border border-border/50">
          {message.text}
          <p className="text-muted-foreground/70 text-[10px] mt-1">{message.time}</p>
        </div>
      </div>
    );
  }
  const g = layout;
  const gPrev = g?.groupWithPrev ?? false;
  const gNext = g?.groupWithNext ?? false;
  const showAiAvatar = message.sender === "ai" && (g?.showAvatar ?? true);
  const aiSpacer = message.sender === "ai" && (g?.avatarSpacer ?? false);
  const showTime = g?.showFootTime ?? true;

  const userShape =
    gPrev && gNext
      ? "rounded-2xl rounded-tr-md rounded-br-md"
      : gPrev
        ? "rounded-2xl rounded-tr-md"
        : gNext
          ? "rounded-2xl rounded-br-md"
          : "rounded-2xl rounded-br-md";
  const aiShape =
    gPrev && gNext
      ? "rounded-2xl rounded-tl-md rounded-bl-md"
      : gPrev
        ? "rounded-2xl rounded-tl-md"
        : gNext
          ? "rounded-2xl rounded-bl-md"
          : "rounded-2xl rounded-bl-md";

  return (
    <div
      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
    >
      <div className="flex items-end gap-2 max-w-[82%] sm:max-w-[75%]">
        {message.sender === "ai" && (showAiAvatar || aiSpacer) && (
          showAiAvatar ? (
            <AvatarImage
              src={companion.avatar}
              seed={companionId}
              alt={companion.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border/40"
            />
          ) : (
            <div className="w-8 h-8 flex-shrink-0" aria-hidden />
          )
        )}
        <div className="min-w-0">
          <div
            className={`px-4 py-2.5 cursor-pointer select-text transition-[box-shadow,transform,filter,background-color] duration-300 ease-out motion-reduce:transition-none hover:shadow-sm hover:brightness-[1.02] active:brightness-95 active:scale-[0.996] ${
              message.sender === "user"
                ? `bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm shadow-black/10 ${userShape}`
                : `bg-secondary/95 text-foreground border border-border/40 shadow-sm ${aiShape} hover:bg-secondary`
            }`}
            onDoubleClick={() => handleCopyMessage(message.text)}
            title={t("chat.doubleClickToCopy")}
          >
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {message.text}
            </p>
          </div>
          {showTime && message.time ? (
            <p className="text-muted-foreground text-[11px] mt-0.5 px-2 tabular-nums">
              {message.time}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export function Chat() {
  const { companionId } = useParams<{ companionId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [copyAck, setCopyAck] = useState(false);
  const {
    connect,
    sendMessage,
    clearUnread,
    clearMessages,
    setActiveCompanionId,
    getCompanionMessages,
    isConnected,
    typingCompanions,
    dismissMessage,
  } = useChat();
  const connected = isConnected[companionId || ""] || false;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [companion, setCompanion] = useState<CompanionInfo>({
    name: t('common.loading'),
    avatar: "",
    online: true,
  });
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const syncedMsgIds = useRef(new Set<number>());
  const copyAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadMoreAtRef = useRef(0);

  const visibleMessages = useMemo(
    () =>
      (messages ?? []).filter(
        (m) =>
          !(m.sender === "system" && isWsConnectWelcomeNotice(m.text))
      ),
    [messages]
  );

  type ChatListRow =
    | { kind: "date"; key: string; label: string }
    | {
        kind: "bubble";
        key: number;
        message: ChatMessage;
        layout: BubbleClusterLayout;
        marginTopClass: string;
      };

  const chatListRows = useMemo((): ChatListRow[] => {
    const list = visibleMessages;
    const rows: ChatListRow[] = [];
    let lastDayKey = "";
    let bubbleIndex = 0;
    let prevRowWasDate = false;

    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const next = i < list.length - 1 ? list[i + 1] : null;

      if (m.ts) {
        const dk = calendarDayKeyFromIso(m.ts);
        if (dk && dk !== lastDayKey) {
          rows.push({
            kind: "date",
            key: `sep-${dk}-${m.id}`,
            label: formatChatDateSeparator(m.ts, i18n.language),
          });
          lastDayKey = dk;
          prevRowWasDate = true;
        }
      }

      let groupWithPrev = false;
      if (
        prev &&
        isConvSender(m.sender) &&
        isConvSender(prev.sender) &&
        !breaksConversationGroup(prev.sender) &&
        !breaksConversationGroup(m.sender)
      ) {
        if (prev.sender === m.sender) {
          const gapMin =
            Math.abs(messageInstant(m) - messageInstant(prev)) / 60000;
          if (gapMin < CHAT_GROUP_GAP_MIN) groupWithPrev = true;
        }
      }

      let groupWithNext = false;
      if (
        next &&
        isConvSender(m.sender) &&
        isConvSender(next.sender) &&
        !breaksConversationGroup(next.sender) &&
        !breaksConversationGroup(m.sender)
      ) {
        if (next.sender === m.sender) {
          const gapMin =
            Math.abs(messageInstant(next) - messageInstant(m)) / 60000;
          if (gapMin < CHAT_GROUP_GAP_MIN) groupWithNext = true;
        }
      }

      const showAvatar =
        m.sender === "ai" && !(groupWithPrev && prev?.sender === "ai");
      const avatarSpacer = m.sender === "ai" && !showAvatar;
      const showFootTime = Boolean(
        m.time && (!isConvSender(m.sender) || !groupWithNext)
      );

      const marginTopClass = prevRowWasDate
        ? "mt-2"
        : bubbleIndex === 0
          ? groupWithPrev
            ? "mt-1"
            : "mt-0"
          : groupWithPrev
            ? "mt-1"
            : "mt-3";

      rows.push({
        kind: "bubble",
        key: m.id,
        message: m,
        layout: {
          groupWithPrev,
          groupWithNext,
          showAvatar,
          avatarSpacer,
          showFootTime,
        },
        marginTopClass,
      });
      bubbleIndex += 1;
      prevRowWasDate = false;
    }
    return rows;
  }, [visibleMessages, i18n.language]);

  // 加载消息（支持初始加载和加载更多）
  const loadMessages = useCallback(async (loadOffset: number, isInitial: boolean) => {
    if (!companionId) return;
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(
        `/companions/${companionId}/messages?limit=20&offset=${loadOffset}`,
        { headers: getAuthHeaders() }
      );
      if (res.status === 401) {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_info");
        navigate("/");
        return;
      }
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const rawMessages = data.messages || [];
      const total = data.total || 0;

      const formatted: ChatMessage[] = rawMessages.map(
        (m: any, idx: number) => ({
          id: loadOffset + idx + 1,
          companionId,
          sender: m.role === "user" ? "user" : "ai",
          text: m.content || "",
          time: m.timestamp
            ? formatMessageTime(m.timestamp, i18n.language)
            : "",
          ts: typeof m.timestamp === "string" ? m.timestamp : undefined,
        })
      );

      if (isInitial) {
        // 标记当前全局消息为已同步，防止组件重新挂载后重复显示
        const globalMsgs = getCompanionMessages(companionId);
        globalMsgs.forEach((m) => syncedMsgIds.current.add(m.id));
        // 合并历史消息和全局消息（全局消息可能包含最新未持久化的消息）
        const globalFormatted = globalMsgs.map((m) => ({
          id: m.id,
          companionId: m.companionId,
          sender: m.sender,
          text: m.text,
          time: m.time,
          ts: m.ts,
        }));
        // REST 与内存 WS 使用不同 id 体系，仅靠 id 去重会在重进页面后同内容出现两条
        const contentKey = (m: ChatMessage) =>
          `${m.sender}\0${(m.text || "").trim()}`;
        const restKeys = new Set(formatted.map(contentKey));
        const globalDeduped = globalFormatted.filter(
          (m) => !restKeys.has(contentKey(m))
        );
        const seen = new Set<number>();
        const merged: ChatMessage[] = [];
        for (const m of [...formatted, ...globalDeduped]) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            merged.push(m);
          }
        }
        // 不按 id 排序：分页 id 为 loadOffset+idx，更旧一页的 id 反而更大，sort 会颠倒时间顺序
        setMessages(merged);
        setOffset(rawMessages.length);
        setHasMore(rawMessages.length < total);
      } else {
        // 在顶部插入更早的消息，保持滚动位置
        const container = scrollRef.current;
        const oldScrollHeight = container?.scrollHeight || 0;

        setMessages((prev) => {
          // 更早一页在前、当前列表在后，即时间从旧到新；切勿按 id 排序（见上）
          return [...formatted, ...(prev ?? [])];
        });
        setOffset((prev) => prev + rawMessages.length);
        setHasMore(loadOffset + rawMessages.length < total);

        // 恢复滚动位置
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("加载聊天记录失败:", err);
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }, [companionId, getCompanionMessages, navigate, i18n.language]);

  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    if (!companionId) return;
    initialScrollDone.current = false;
    setAccessDenied(false);

    Promise.all([
      fetch(`/companions/${companionId}`, { headers: getAuthHeaders() }).then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("user_token");
          localStorage.removeItem("user_info");
          navigate("/");
          return null;
        }
        if (r.status === 403) {
          setAccessDenied(true);
          throw new Error("forbidden");
        }
        if (!r.ok) throw new Error("加载失败");
        return r.json();
      }),
      loadMessagesRef.current(0, true),
    ])
      .then(([companionData]) => {
        if (!companionData) return;
        const profile = companionData.profile || {};
        const avatar = companionData.avatar || "";
        setCompanion({
          name: profile.name || t('chat.defaultName'),
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${companionId}`,
          online: true,
        });
      })
      .catch((err) => {
        console.error("加载失败:", err);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionId, t, navigate]);

  useEffect(() => {
    if (!companionId) return;
    // 仅切换会话时重置：若依赖全局 messages，会在每条新消息时把 id 全部标为已同步，
    // 导致下一段 effect 无法把 WS 新消息同步到本地，或与其他逻辑竞态产生重复气泡
    syncedMsgIds.current.clear();
    getCompanionMessages(companionId).forEach((m) =>
      syncedMsgIds.current.add(m.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只在 companionId 变化时同步 ref
  }, [companionId]);

  useEffect(() => {
    if (!companionId) return;
    setActiveCompanionId(companionId);
    connect(companionId);
    clearUnread(companionId);
    return () => {
      setActiveCompanionId(null);
      // 不再断开连接，保持后台消息接收能力
      // disconnect(companionId);
    };
  }, [companionId, connect, setActiveCompanionId, clearUnread]);

  useEffect(() => {
    if (!companionId) return;
    setCompanion((prev) => ({ ...prev, online: connected }));
  }, [connected, companionId]);

  // 当全局消息更新时，同步到当前聊天界面（基于唯一 id 去重）
  const globalMessages = useMemo(() => {
    const list = getCompanionMessages(companionId || "");
    return Array.isArray(list) ? list : [];
  }, [getCompanionMessages, companionId]);
  useEffect(() => {
    if (!companionId) return;
    const newMsgs = (globalMessages ?? []).filter(
      (m) => !syncedMsgIds.current.has(m.id)
    );
    if (newMsgs.length > 0) {
      newMsgs.forEach((m) => syncedMsgIds.current.add(m.id));
      setMessages((prev) => {
        // 不再按 AI 正文与上一条去重：连发时服务端分段/短语气泡会连续同文，误丢会导致与 WS 顺序「串」
        const base = prev ?? [];
        return [
          ...base,
          ...newMsgs.map((m) => ({
            id: m.id,
            companionId: m.companionId,
            sender: m.sender,
            text: m.text,
            time: m.time,
            ts: m.ts,
          })),
        ];
      });
      // 正在输入仅由 ChatContext 的 typingCompanions（WS）驱动，勿在此处对每条消息（含用户）setIsTyping(false)，否则连发会与服务端 typing 打架
      setIsSending(false);
      // 收到新消息后，若用户已在底部则自动滚动，否则不打扰用户浏览历史消息
      requestAnimationFrame(() => {
        if (isNearBottom()) {
          scrollToBottom();
        }
      });
    }
  }, [globalMessages, companionId]);

  // 同步全局 typing 状态到本地
  useEffect(() => {
    if (!companionId) return;
    setIsTyping(!!typingCompanions[companionId]);
  }, [typingCompanions, companionId]);

  // 连接断开时重置发送和打字状态
  useEffect(() => {
    const conn = isConnected[companionId || ""] || false;
    if (!conn) {
      setIsTyping(false);
      setIsSending(false);
    }
  }, [isConnected, companionId]);

  // 点击表情面板外部时关闭
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // 点击菜单外部时关闭
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const isNearBottom = () => {
    const container = scrollRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
  };

  // 初始加载完成后滚动到底部
  useEffect(() => {
    if (!loading && visibleMessages.length > 0 && !initialScrollDone.current) {
      scrollToBottom();
      initialScrollDone.current = true;
    }
  }, [loading, visibleMessages.length]);

  // 新消息/WebSocket 更新时自动滚动到底部（但加载更多时不滚动）
  useEffect(() => {
    if (!loading && !loadingMore && isTyping) {
      scrollToBottom();
    }
  }, [isTyping, loading, loadingMore]);

  // 滚动监听：接近顶部时加载更多
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      if (container.scrollTop >= 50) return;
      const now = Date.now();
      if (now - lastLoadMoreAtRef.current < 450) return;
      lastLoadMoreAtRef.current = now;
      loadMessages(offset, false);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [offset, hasMore, loadingMore, companionId, loadMessages]);

  const handleSend = () => {
    if (!input.trim() || !companionId || isSending) return;
    const text = input.trim();
    setInput("");
    if (!connected) {
      sendMessage(companionId, text);
      return;
    }
    setIsSending(true);
    sendMessage(companionId, text);
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (copyAckTimerRef.current) clearTimeout(copyAckTimerRef.current);
      setCopyAck(true);
      copyAckTimerRef.current = setTimeout(() => {
        setCopyAck(false);
        copyAckTimerRef.current = null;
      }, 1600);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      if (copyAckTimerRef.current) clearTimeout(copyAckTimerRef.current);
      setCopyAck(true);
      copyAckTimerRef.current = setTimeout(() => {
        setCopyAck(false);
        copyAckTimerRef.current = null;
      }, 1600);
    }
  };

  const lastVisibleForTyping =
    visibleMessages.length > 0
      ? visibleMessages[visibleMessages.length - 1]
      : undefined;
  const typingShowsCompanionAvatar =
    !lastVisibleForTyping || lastVisibleForTyping.sender !== "ai";

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <p className="text-muted-foreground text-center mb-6">{t("chat.accessDenied")}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-6 py-2 rounded-full bg-secondary text-foreground border border-border"
          data-analytics-button="chat-access-denied-back"
        >
          {t("chat.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background relative">
      {copyAck && (
        <div
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 pointer-events-none"
          role="status"
        >
          <div className="chat-copy-toast px-4 py-2.5 rounded-full bg-foreground/90 text-background text-sm shadow-lg backdrop-blur-sm">
            {t("chat.copySuccess")}
          </div>
        </div>
      )}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full transition-all duration-300 ease-out hover:bg-muted/60 active:opacity-70"
              data-analytics-button="chat-back"
              data-analytics-name="聊天页返回"
            >
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => navigate(`/companion/${companionId}`)}
              className="flex items-center gap-3 rounded-xl -mx-1 px-1 py-0.5 transition-opacity duration-300 ease-out hover:opacity-90 active:opacity-80"
              data-analytics-button="chat-view-profile"
              data-analytics-name="聊天页查看伴侣资料"
            >
              <AvatarImage
                src={companion.avatar}
                seed={companionId}
                alt={companion.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-foreground flex items-center gap-2">
                  {companion.name}
                  {companion.online && (
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {connected ? t('chat.online') : t('chat.connecting')}
                </p>
              </div>
            </button>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              className="p-2 -mr-2 rounded-full transition-all duration-300 ease-out hover:bg-muted/60 active:opacity-70"
              data-analytics-button="chat-menu"
              data-analytics-name="聊天页更多菜单"
              onClick={() => setShowMenu((v) => !v)}
            >
              <MoreVertical className="w-5 h-5 text-foreground" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 w-40 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors duration-200 ease-out"
                  data-analytics-button="chat-menu-view-profile"
                  data-analytics-name="聊天菜单查看资料"
                  onClick={() => {
                    setShowMenu(false);
                    navigate(`/companion/${companionId}`);
                  }}
                >
                  {t('chat.viewProfile')}
                </button>
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors duration-200 ease-out"
                  data-analytics-button="chat-clear-messages"
                  data-analytics-name="聊天菜单清空消息"
                  onClick={async () => {
                    setShowMenu(false);
                    if (!companionId) return;
                    if (!confirm(t('chat.confirmClearMessages'))) return;
                    try {
                      const res = await fetch(
                        `/companions/${companionId}/clear-messages`,
                        { method: "POST", headers: getAuthHeaders() }
                      );
                      if (res.ok) {
                        setMessages([]);
                        syncedMsgIds.current.clear();
                        setOffset(0);
                        setHasMore(true);
                        clearMessages(companionId);
                        alert(t('chat.clearSuccess'));
                      } else {
                        alert(t('chat.clearFailed'));
                      }
                    } catch (err) {
                      console.error("清空聊天记录失败:", err);
                      alert(t('chat.clearFailed'));
                    }
                  }}
                >
                  {t('chat.clearMessages')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col relative">

        {loadingMore && (
          <div className="flex items-center justify-center py-3 text-muted-foreground text-xs">
            <div
              className="animate-spin rounded-full h-4 w-4 border-2 border-primary/30 border-t-primary/80 mr-2"
              style={{ animationDuration: "0.85s" }}
            />
            {t('chat.loadingEarlier')}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div
              className="animate-spin rounded-full h-6 w-6 border-2 border-primary/30 border-t-primary/80 mr-2"
              style={{ animationDuration: "0.85s" }}
            />
            {t('chat.loadingHistory')}
          </div>
        )}
        {!loading && visibleMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('chat.noMessages')}
          </div>
        )}
        {chatListRows.map((row) =>
          row.kind === "date" ? (
            <div key={row.key} className="flex justify-center shrink-0 px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground/90 tabular-nums bg-muted/45 border border-border/35 rounded-full px-3 py-0.5">
                {row.label}
              </span>
            </div>
          ) : (
            <div key={row.key} className={row.marginTopClass}>
              <MessageBubble
                message={row.message}
                companion={companion}
                companionId={companionId}
                handleCopyMessage={handleCopyMessage}
                dismissMessage={dismissMessage}
                t={t}
                layout={row.layout}
              />
            </div>
          )
        )}

        {isTyping && (
          <div
            className={`flex justify-start ${visibleMessages.length > 0 ? "mt-1" : ""}`}
          >
            <div className="flex items-end gap-2 max-w-[82%] sm:max-w-[75%]">
              {typingShowsCompanionAvatar ? (
                <AvatarImage
                  src={companion.avatar}
                  seed={companionId}
                  alt={companion.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border/40"
                />
              ) : (
                <div className="w-8 h-8 flex-shrink-0" aria-hidden />
              )}
              <div className="bg-secondary/95 border border-border/40 shadow-sm rounded-2xl rounded-bl-md px-4 py-3 min-h-[2.5rem] flex items-center transition-opacity duration-300">
                <div className="flex gap-1.5 items-center" aria-label={t("messages.typing")}>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full chat-typing-dot" />
                  <span
                    className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full chat-typing-dot"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full chat-typing-dot"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              className="p-2 rounded-full transition-all duration-300 ease-out hover:bg-muted/50 active:opacity-70"
              data-analytics-button="chat-emoji"
              data-analytics-name="聊天页表情按钮"
              onClick={() => setShowEmojiPicker((v) => !v)}
            >
              <Smile className="w-6 h-6 text-foreground" />
            </button>

            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg p-3 w-64 max-h-48 overflow-y-auto z-50 origin-bottom-left animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="grid grid-cols-8 gap-1">
                  {[
                    "😀","😃","😄","😁","😆","😅","🤣","😂",
                    "🙂","🙃","😉","😊","😇","🥰","😍","🤩",
                    "😘","😗","😚","😙","😋","😛","😜","🤪",
                    "😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨",
                    "😐","😑","😶","😏","😒","🙄","😬","🤥",
                    "😌","😔","😪","🤤","😴","😷","🤒","🤕",
                    "🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠",
                    "🥳","😎","🤓","🧐","😕","😟","🙁","☹️",
                    "😮","😯","😲","😳","🥺","😦","😧","😨",
                    "😰","😥","😢","😭","😱","😖","😣","😞",
                    "😓","😩","😫","🥱","😤","😡","😠","🤬",
                    "😈","👿","💀","☠️","💩","🤡","👹","👺",
                    "👻","👽","👾","🤖","❤️","🧡","💛","💚",
                    "💙","💜","🖤","🤍","🤎","💔","❣️","💕",
                    "💞","💓","💗","💖","💘","💝","💟","🔥",
                    "✨","🎉","🎊","🎁","🌹","🌸","🌺","🌻",
                    "🌼","🌷","💐","🍀","🌿","🌱","🌲","🌳",
                    "🌴","🌵","🍁","🍂","🍃","🍄","🌾","💫",
                    "⭐","🌟","⚡","☀️","🌤️","⛅","🌥️","☁️",
                    "🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄",
                    "🌊","💧","💦","☔","🌈","☂️","🌂","🌀",
                    "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓",
                    "🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝",
                    "🍅","🥑","🍆","🥔","🥕","🌽","🌶️","🫑",
                    "🥒","🥬","🥦","🧄","🧅","🍄","🥜","🌰",
                    "🍞","🥐","🥖","🥨","🥯","🥞","🧇","🧀",
                    "🍖","🍗","🥩","🥓","🍔","🍟","🍕","🌭",
                    "🥪","🌮","🌯","🫔","🥙","🧆","🥚","🍳",
                    "🥘","🍲","🫕","🥣","🥗","🍿","🧈","🧂",
                    "🥫","🍱","🍘","🍙","🍚","🍛","🍜","🍝",
                    "🍠","🍢","🍣","🍤","🍥","🥮","🍡","🥟",
                    "🥠","🥡","🍦","🍧","🍨","🍩","🍪","🎂",
                    "🍰","🧁","🥧","🍫","🍬","🍭","🍮","🍯",
                    "🍼","🥛","☕","🫖","🍵","🍶","🍾","🍷",
                    "🍸","🍹","🍺","🍻","🥂","🥃","🫗","🥤",
                    "🧃","🧉","🧊","🥢","🍽️","🍴","🥄","🔪",
                    "🏀","⚽","🏈","⚾","🥎","🎾","🏐","🏉",
                    "🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍",
                    "🏏","🥅","⛳","🪁","🏹","🎣","🤿","🥊",
                    "🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿",
                    "⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺",
                    "🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣",
                    "🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅",
                    "🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹","🎭",
                    "🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁",
                    "🪘","🎷","🎺","🎸","🪕","🎻","🎲","♟️",
                    "🎯","🎳","🎮","🎰","🧩","🚗","🚕","🚙",
                    "🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜",
                    "🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴",
                    "🚏","🛣️","🛤️","🚂","🚃","🚄","🚅","🚆",
                    "🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌",
                    "🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕",
                    "🚖","🚗","🚘","🚙","🛻","🚚","🚛","🚜",
                    "🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴",
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      className="text-xl p-1 rounded-md hover:bg-secondary/80 transition-colors duration-200 ease-out active:scale-95"
                      onClick={() => {
                        setInput((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 bg-secondary rounded-full px-4 py-2 max-h-24 overflow-y-auto transition-[box-shadow,background-color] duration-300 ease-out focus-within:ring-1 focus-within:ring-primary/20 focus-within:shadow-sm">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('chat.placeholder')}
              className="w-full bg-transparent text-foreground placeholder-muted-foreground outline-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            title={!connected ? t("chat.sendQueuedHint") : undefined}
            data-analytics-button="chat-send"
            data-analytics-name="聊天页发送消息"
            className={`p-2.5 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center rounded-full transition-all duration-300 ease-out ${
              input.trim() && !isSending
                ? "bg-gradient-to-r from-pink-500 to-purple-600 shadow-sm shadow-pink-500/25 hover:shadow-md hover:shadow-pink-500/30 active:scale-[0.96]"
                : "bg-secondary opacity-80"
            } ${!input.trim() || isSending ? "cursor-not-allowed" : ""}`}
          >
            <Send
              className={`w-5 h-5 ${
                input.trim() && !isSending ? "text-white" : "text-muted-foreground"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
