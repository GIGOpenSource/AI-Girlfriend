import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/ToastContext";

interface FeedbackMessage {
  id: number;
  sender: "user" | "system" | "admin";
  content: string;
  created_at: string;
}

export function FeedbackChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem("user_token") || "";

  // 加载历史消息
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback/messages", {
        headers: { "x-token": token },
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast(t('feedback.loginExpired'));
          navigate("/");
          return;
        }
        throw new Error("加载失败");
      }
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("加载反馈消息失败:", err);
    } finally {
      setLoading(false);
    }
  }, [navigate, t, token]);

  useEffect(() => {
    if (!token) {
      toast(t('feedback.loginRequired'));
      navigate("/");
      return;
    }
    loadMessages();
  }, [loadMessages, navigate, t, token]);

  // 新消息到达后滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setIsSending(true);
    setInput("");

    // 乐观更新：先显示用户消息
    const optimisticMsg: FeedbackMessage = {
      id: Date.now(),
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/feedback/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-token": token,
        },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast(t('feedback.loginExpired'));
          navigate("/");
          return;
        }
        throw new Error("发送失败");
      }
      // 发送成功后重新加载完整消息列表（包含自动回复）
      await loadMessages();
    } catch (err) {
      console.error("发送反馈失败:", err);
      // 移除乐观更新
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      toast(t('feedback.sendFailed'));
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (iso: string) => {
    if (!iso) return "";
    let normalized = iso.trim();
    if (!normalized.endsWith("Z") && !normalized.match(/[+-]\d{2}:\d{2}$/)) {
      normalized = `${normalized}Z`;
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部导航 */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" data-analytics-button="feedback-back" data-analytics-name="反馈页返回">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-foreground">{t('feedback.title')}</p>
              <p className="text-muted-foreground text-xs">{t('feedback.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            {t('common.loading')}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('feedback.noMessages')}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div className="flex items-end gap-2 max-w-[75%]">
              {message.sender !== "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div>
                <div
                  className={`rounded-2xl px-4 py-2 ${
                    message.sender === "user"
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className="text-muted-foreground text-xs mt-1 px-2">
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div className="bg-card border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-secondary rounded-full px-4 py-2 max-h-24 overflow-y-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isSending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('feedback.placeholder')}
              className="w-full bg-transparent text-foreground placeholder-muted-foreground outline-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            data-analytics-button="feedback-send"
            data-analytics-name="反馈页发送消息"
            className={`p-2 rounded-full transition-all ${
              input.trim() && !isSending
                ? "bg-gradient-to-r from-pink-500 to-purple-600"
                : "bg-secondary"
            }`}
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
