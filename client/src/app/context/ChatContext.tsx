import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import i18n from "../../i18n";
import { formatNowMessageTime } from "../utils/chatTime";
import { isWsConnectWelcomeNotice } from "../utils/chatConnectNotice";
import { normalizeUiLang } from "../utils/uiLanguage";

export interface ChatMessage {
  id: number;
  companionId: string;
  sender: "user" | "ai" | "system" | "thinking" | "filler";
  text: string;
  time: string;
  /** ISO 8601，用于会话列表分组与日期条；无则仅依赖展示用 time */
  ts?: string;
}

function getWsOrigin(): string {
  const explicit = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

/** 与后端 build_dialogue_time_context 对齐：IANA 时区 + JS getTimezoneOffset（UTC−本地，分） */
function buildChatWsPayload(text: string, lang: string, userGender: string) {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    /* ignore */
  }
  let tz_offset: number | undefined;
  try {
    tz_offset = new Date().getTimezoneOffset();
  } catch {
    /* ignore */
  }
  return { text, lang, user_gender: userGender, tz, tz_offset };
}

interface LastMessageInfo {
  text: string;
  time: string;
  fullTime?: string;
}

interface ChatContextValue {
  messages: ChatMessage[];
  unreadCounts: Record<string, number>;
  lastMessages: Record<string, LastMessageInfo>;
  isConnected: Record<string, boolean>;
  typingCompanions: Record<string, boolean>;
  activeCompanionId: string | null;
  dismissMessage: (id: number) => void;
  setActiveCompanionId: (id: string | null) => void;
  connect: (companionId: string) => void;
  disconnect: (companionId: string) => void;
  sendMessage: (companionId: string, text: string) => void;
  clearUnread: (companionId: string) => void;
  clearMessages: (companionId: string) => void;
  getCompanionMessages: (companionId: string) => ChatMessage[];
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<
    Record<string, LastMessageInfo>
  >({});
  const [isConnected, setIsConnected] = useState<Record<string, boolean>>({});
  const [typingCompanions, setTypingCompanions] = useState<
    Record<string, boolean>
  >({});
  const [activeCompanionId, setActiveCompanionId] = useState<string | null>(
    null
  );
  const activeCompanionIdRef = useRef<string | null>(null);
  const connectionsRef = useRef<Record<string, WebSocket>>({});
  // 全局消息ID从较大基数开始，避免与历史消息 loadOffset+idx 冲突
  const msgIdRef = useRef(1000000);

  // 生成唯一消息ID
  const nextMsgId = useCallback(() => msgIdRef.current++, []);

  // 全局消息数量上限，防止内存无限制增长
  const MAX_MESSAGES = 5000;
  const MESSAGE_TRIM_TARGET = 3000;

  const appendMessages = useCallback((newMsgs: ChatMessage[]) => {
    if (newMsgs.length === 0) return;

    setMessages((prev) => {
      const base = prev ?? [];
      const next = [...base, ...newMsgs];
      if (next.length > MAX_MESSAGES) {
        return next.slice(-MESSAGE_TRIM_TARGET);
      }
      return next;
    });
  }, []);

  const dismissMessage = useCallback((id: number) => {
    setMessages((prev) => (prev ?? []).filter((m) => m.id !== id));
  }, []);

  // 重连相关
  const reconnectTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const reconnectAttemptsRef = useRef<Record<string, number>>({});
  const intentionallyClosedRef = useRef<Record<string, boolean>>({});
  const trackedCompanionIdsRef = useRef<Set<string>>(new Set());
  const visibilityReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const languageReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const outboxRef = useRef<Record<string, string[]>>({});
  const queueNoticeSentRef = useRef<Record<string, boolean>>({});

  const flushOutboxForCompanion = useCallback((companionId: string) => {
    const ws = connectionsRef.current[companionId];
    if (ws?.readyState !== WebSocket.OPEN) return;
    const pending = outboxRef.current[companionId];
    if (!pending?.length) return;
    const lang = normalizeUiLang(i18n.language);
    let userGender = "";
    try {
      const userInfoStr = localStorage.getItem("user_info");
      userGender = userInfoStr ? JSON.parse(userInfoStr).gender || "" : "";
    } catch {
      /* ignore */
    }
    for (const queued of pending) {
      try {
        ws.send(JSON.stringify(buildChatWsPayload(queued, lang, userGender)));
      } catch (err) {
        console.error("发送队列消息失败:", err);
        break;
      }
    }
    delete outboxRef.current[companionId];
  }, [i18n.language]);

  // 持久化未读数到 localStorage
  useEffect(() => {
    const saved = localStorage.getItem("chat_unread");
    if (saved) {
      try {
        setUnreadCounts(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
    const savedLast = localStorage.getItem("chat_last_messages");
    if (savedLast) {
      try {
        setLastMessages(JSON.parse(savedLast));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("chat_unread", JSON.stringify(unreadCounts));
  }, [unreadCounts]);

  useEffect(() => {
    activeCompanionIdRef.current = activeCompanionId;
  }, [activeCompanionId]);

  useEffect(() => {
    localStorage.setItem("chat_last_messages", JSON.stringify(lastMessages));
  }, [lastMessages]);

  const connect = useCallback((companionId: string) => {
    trackedCompanionIdsRef.current.add(companionId);
    const existing = connectionsRef.current[companionId];
    // 已在连接或连接中：避免重复创建；CONNECTING 时尚未握手完成，不得标为已连接
    if (existing?.readyState === WebSocket.OPEN) {
      setIsConnected((prev) => ({ ...prev, [companionId]: true }));
      return;
    }
    if (existing?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // 如果存在旧连接（哪怕是 CLOSING 状态），先标记为手动关闭并清理，
    // 防止旧连接的 onclose 触发不必要的重连定时器
    if (existing) {
      intentionallyClosedRef.current[companionId] = true;
      existing.close();
      delete connectionsRef.current[companionId];
    }

    // 清除之前的重连定时器
    if (reconnectTimersRef.current[companionId]) {
      clearTimeout(reconnectTimersRef.current[companionId]);
      delete reconnectTimersRef.current[companionId];
    }

    intentionallyClosedRef.current[companionId] = false;

    const lang = normalizeUiLang(i18n.language);
    const token = localStorage.getItem("user_token") || "";
    const origin = getWsOrigin();
    const wsUrl = `${origin}/ws/chat/${companionId}?lang=${encodeURIComponent(lang)}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    connectionsRef.current[companionId] = ws;

    ws.onopen = () => {
      setIsConnected((prev) => ({ ...prev, [companionId]: true }));
      // 连接成功，重置重连计数
      reconnectAttemptsRef.current[companionId] = 0;
      queueNoticeSentRef.current[companionId] = false;
      flushOutboxForCompanion(companionId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "toast") {
          const text = data.text || "";
          // 仅服务端「括号思考」类 toast 带 💭；其它 toast 不插入思考条，避免非括号正文进思考区
          const t = text.trimStart();
          if (t.startsWith("💭")) {
            const thinkId = nextMsgId();
            appendMessages([
              {
                id: thinkId,
                companionId,
                sender: "thinking",
                text,
                time: formatNowMessageTime(i18n.language || "zh"),
                ts: new Date().toISOString(),
              },
            ]);
            window.setTimeout(() => dismissMessage(thinkId), 5000);
          }
        } else if (data.type === "filler" && typeof data.text === "string" && data.text.trim()) {
          const fillId = nextMsgId();
          appendMessages([
            {
              id: fillId,
              companionId,
              sender: "filler",
              text: data.text.trim(),
              time: formatNowMessageTime(i18n.language || "zh"),
              ts: new Date().toISOString(),
            },
          ]);
          window.setTimeout(() => dismissMessage(fillId), 4500);
        } else if (data.type === "system" && data.text) {
          const sysText = String(data.text);
          if (!isWsConnectWelcomeNotice(sysText)) {
            appendMessages([
              {
                id: nextMsgId(),
                companionId,
                sender: "system",
                text: sysText,
                time: formatNowMessageTime(i18n.language || "zh"),
                ts: new Date().toISOString(),
              },
            ]);
          }
        } else if (data.type === "typing") {
          setTypingCompanions((prev) => ({ ...prev, [companionId]: true }));
        } else if (data.type === "message" && data.role === "assistant") {
          const text = data.text || "";
          const time = formatNowMessageTime(i18n.language || "zh");

          // 略延迟关 typing，避免「正在输入」瞬间消失与首条气泡之间像被删掉一帧
          window.setTimeout(() => {
            setTypingCompanions((prev) => ({ ...prev, [companionId]: false }));
          }, 140);

          setLastMessages((prev) => ({
            ...prev,
            [companionId]: { text, time, fullTime: new Date().toISOString() },
          }));

          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "ai",
              text,
              time,
              ts: new Date().toISOString(),
            },
          ]);

          // 如果当前不在该 companion 的聊天页面，增加未读
          if (activeCompanionIdRef.current !== companionId) {
            setUnreadCounts((prev) => ({
              ...prev,
              [companionId]: (prev[companionId] || 0) + 1,
            }));
            // 浏览器通知（如果页面不在前台）
            if (document.hidden && "Notification" in window) {
              if (Notification.permission === "granted") {
                const preview =
                  text.length > 160 ? `${text.slice(0, 160)}…` : text;
                new Notification(i18n.t("chat.notificationTitle"), {
                  body: i18n.t("chat.notificationBody", { preview }),
                  icon: "/favicon.ico",
                });
              } else if (Notification.permission === "default") {
                Notification.requestPermission();
              }
            }
          }
        } else if (data.type === "error") {
          setTypingCompanions((prev) => ({ ...prev, [companionId]: false }));
          const detail =
            typeof data.text === "string" && data.text.trim()
              ? data.text.trim()
              : i18n.t("chat.connectionAbnormal");
          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "ai",
              text: detail,
              time: formatNowMessageTime(i18n.language || "zh"),
              ts: new Date().toISOString(),
            },
          ]);
        }
      } catch (e) {
        console.error("解析消息失败:", e);
      }
    };

    ws.onerror = () => {
      setIsConnected((prev) => ({ ...prev, [companionId]: false }));
    };

    ws.onclose = () => {
      setIsConnected((prev) => ({ ...prev, [companionId]: false }));
      setTypingCompanions((prev) => ({ ...prev, [companionId]: false }));
      // 只有当前 ws 仍然被引用时才删除，避免误删新创建的连接
      if (connectionsRef.current[companionId] === ws) {
        delete connectionsRef.current[companionId];
      }

      // 如果不是手动关闭，触发自动重连（指数退避，最多 12 次；切回前台会重置次数）
      if (!intentionallyClosedRef.current[companionId]) {
        const attempts = reconnectAttemptsRef.current[companionId] || 0;
        if (attempts < 12) {
          reconnectAttemptsRef.current[companionId] = attempts + 1;
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
          reconnectTimersRef.current[companionId] = setTimeout(() => {
            connect(companionId);
          }, delay);
        }
      }
    };
  }, [appendMessages, nextMsgId, flushOutboxForCompanion, i18n.language, dismissMessage]);

  const disconnect = useCallback((companionId: string) => {
    intentionallyClosedRef.current[companionId] = true;

    // 清除重连定时器
    if (reconnectTimersRef.current[companionId]) {
      clearTimeout(reconnectTimersRef.current[companionId]);
      delete reconnectTimersRef.current[companionId];
    }

    const ws = connectionsRef.current[companionId];
    if (ws) {
      ws.close();
      delete connectionsRef.current[companionId];
    }
    setIsConnected((prev) => ({ ...prev, [companionId]: false }));
  }, []);

  const sendMessage = useCallback(
    (companionId: string, text: string) => {
      appendMessages([
        {
          id: nextMsgId(),
          companionId,
          sender: "user",
          text,
          time: formatNowMessageTime(i18n.language || "zh"),
          ts: new Date().toISOString(),
        },
      ]);
      setLastMessages((prev) => ({
        ...prev,
        [companionId]: {
          text,
          time: formatNowMessageTime(i18n.language || "zh"),
          fullTime: new Date().toISOString(),
        },
      }));

      const ws = connectionsRef.current[companionId];
      const lang = normalizeUiLang(i18n.language);
      let userGender = "";
      try {
        const userInfoStr = localStorage.getItem("user_info");
        userGender = userInfoStr ? JSON.parse(userInfoStr).gender || "" : "";
      } catch {
        /* ignore */
      }

      if (ws?.readyState === WebSocket.OPEN) {
        flushOutboxForCompanion(companionId);
        try {
          ws.send(JSON.stringify(buildChatWsPayload(text, lang, userGender)));
          // 与 WS 服务端即将下发的 typing 一致，避免等回包前本地「正在输入」被其它 effect 清掉
          setTypingCompanions((prev) => ({ ...prev, [companionId]: true }));
        } catch (err) {
          console.error("发送消息失败:", err);
          const pending = outboxRef.current[companionId] || [];
          pending.push(text);
          outboxRef.current[companionId] = pending;
          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "system",
              text: i18n.t("chat.messageQueued"),
              time: formatNowMessageTime(i18n.language || "zh"),
              ts: new Date().toISOString(),
            },
          ]);
        }
      } else {
        const pending = outboxRef.current[companionId] || [];
        pending.push(text);
        outboxRef.current[companionId] = pending;
        if (!queueNoticeSentRef.current[companionId]) {
          queueNoticeSentRef.current[companionId] = true;
          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "system",
              text: i18n.t("chat.messageQueued"),
              time: formatNowMessageTime(i18n.language || "zh"),
              ts: new Date().toISOString(),
            },
          ]);
        }
      }
    },
    [appendMessages, nextMsgId, flushOutboxForCompanion, i18n.language]
  );

  const clearUnread = useCallback((companionId: string) => {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[companionId];
      return next;
    });
  }, []);

  const clearMessages = useCallback((companionId: string) => {
    setMessages((prev) => (prev ?? []).filter((m) => m.companionId !== companionId));
    setLastMessages((prev) => {
      const next = { ...prev };
      delete next[companionId];
      return next;
    });
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[companionId];
      return next;
    });
    delete outboxRef.current[companionId];
    queueNoticeSentRef.current[companionId] = false;
  }, []);

  const getCompanionMessages = useCallback(
    (companionId: string) => {
      return (messages ?? []).filter((m) => m.companionId === companionId);
    },
    [messages]
  );

  // 页面可见性：回前台重置重连计数并尝试重连（防抖，避免切应用时短时多次连接触发）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      if (visibilityReconnectTimerRef.current) {
        clearTimeout(visibilityReconnectTimerRef.current);
      }
      visibilityReconnectTimerRef.current = setTimeout(() => {
        visibilityReconnectTimerRef.current = null;
        reconnectAttemptsRef.current = {};
        trackedCompanionIdsRef.current.forEach((cid) => {
          connect(cid);
        });
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      }, 400);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (visibilityReconnectTimerRef.current) {
        clearTimeout(visibilityReconnectTimerRef.current);
        visibilityReconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  // 切换界面语言后重连 WS，使会话 lang 与欢迎语等与 UI 一致（防抖）
  useEffect(() => {
    const onLang = () => {
      if (languageReconnectTimerRef.current) {
        clearTimeout(languageReconnectTimerRef.current);
      }
      languageReconnectTimerRef.current = setTimeout(() => {
        languageReconnectTimerRef.current = null;
        reconnectAttemptsRef.current = {};
        trackedCompanionIdsRef.current.forEach((cid) => connect(cid));
      }, 320);
    };
    i18n.on("languageChanged", onLang);
    return () => {
      i18n.off("languageChanged", onLang);
      if (languageReconnectTimerRef.current) {
        clearTimeout(languageReconnectTimerRef.current);
        languageReconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  const contextValue = useMemo(
    () => ({
      messages,
      unreadCounts,
      lastMessages,
      isConnected,
      typingCompanions,
      activeCompanionId,
      dismissMessage,
      setActiveCompanionId,
      connect,
      disconnect,
      sendMessage,
      clearUnread,
      clearMessages,
      getCompanionMessages,
    }),
    [
      messages,
      unreadCounts,
      lastMessages,
      isConnected,
      typingCompanions,
      activeCompanionId,
      dismissMessage,
      setActiveCompanionId,
      connect,
      disconnect,
      sendMessage,
      clearUnread,
      clearMessages,
      getCompanionMessages,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}
