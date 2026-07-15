import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AvatarImage } from "../components/AvatarImage";
import { MomentImage } from "../components/MomentImage";
import {
  ArrowLeft,
  Camera,
  Info,
  Bell,
} from "lucide-react";

type NotificationType = "moment" | "system";
type FilterType = "all" | NotificationType;

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  avatar?: string;
  imageUrl?: string;
  time: string;
  read: boolean;
  companionId?: string;
  momentId?: number;
}

interface SystemNotificationItem {
  id: number;
  title: string;
  content: string;
  language: string;
  created_at: string;
}

function parseStoredNumberList(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is number => typeof item === "number");
  } catch {
    return [];
  }
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

  if (diffSec < 60) return t("messages.justNow") as string;
  if (diffMin < 60) return t("messages.minutesAgo", { count: diffMin } as any) as string;
  if (diffHour < 24) return t("messages.hoursAgo", { count: diffHour } as any) as string;
  if (diffDay === 1) return t("messages.yesterday") as string;
  if (diffDay < 7) return t("messages.daysAgo", { count: diffDay } as any) as string;
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

export function Notifications() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const deviceId = getDeviceId();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [momentsRes, sysNotifRes] = await Promise.all([
        fetch(`/api/moments?limit=20&lang=${encodeURIComponent(i18n.language || "zh")}`, {
          headers: { "x-device-id": deviceId },
        }).then((r) => r.json()),
        fetch(`/api/notifications?language=${i18n.language}&limit=20`).then((r) => r.json()),
      ]);

      const list: NotificationItem[] = [];

      // 1. 朋友圈动态通知
      const moments = momentsRes.moments || [];
      const lastViewed = localStorage.getItem("moments_last_viewed");
      moments.forEach((m: any) => {
        const isUnread = lastViewed
          ? new Date(m.created_at).getTime() > new Date(lastViewed).getTime()
          : true;
        list.push({
          id: `moment-${m.id}`,
          type: "moment",
          title: m.companion_name || t("home.defaultCompanionName"),
          content: m.caption || "",
          avatar:
            m.companion_avatar ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.companion_id}`,
          imageUrl: m.image_url,
          time: m.created_at,
          read: !isUnread,
          momentId: m.id,
        });
      });

      // 2. 系统通知（从后端获取，按用户当前语言筛选）
      const sysNotifications: SystemNotificationItem[] = sysNotifRes.notifications || [];
      const viewedSysKey = `sys_notifications_viewed_${i18n.language}`;
      const viewedSysIds = parseStoredNumberList(localStorage.getItem(viewedSysKey));

      sysNotifications.forEach((n) => {
        list.push({
          id: `sys-${n.id}`,
          type: "system",
          title: n.title,
          content: n.content,
          time: n.created_at,
          read: viewedSysIds.includes(n.id),
        });
      });

      // 按时间倒序排列
      list.sort((a, b) => {
        const aTime = a.time ? new Date(a.time).getTime() : 0;
        const bTime = b.time ? new Date(b.time).getTime() : 0;
        return bTime - aTime;
      });

      // 进入通知页面后，自动标记所有通知为已读
      localStorage.setItem("moments_last_viewed", new Date().toISOString());
      const allSysIds = sysNotifications.map((n) => n.id);
      localStorage.setItem(viewedSysKey, JSON.stringify(allSysIds));

      // 更新通知列表，全部标记为已读
      setNotifications(list.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error("加载通知失败:", e);
    } finally {
      setLoading(false);
    }
  }, [deviceId, i18n.language, t]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClick = (item: NotificationItem) => {
    // 标记为已读
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );

    if (item.type === "system") {
      const sysIdMatch = item.id.match(/^sys-(\d+)$/);
      if (sysIdMatch) {
        const sysId = parseInt(sysIdMatch[1], 10);
        const viewedSysKey = `sys_notifications_viewed_${i18n.language}`;
        const viewedSysIds = parseStoredNumberList(localStorage.getItem(viewedSysKey));
        if (!viewedSysIds.includes(sysId)) {
          viewedSysIds.push(sysId);
          localStorage.setItem(viewedSysKey, JSON.stringify(viewedSysIds));
        }
      }
    } else if (item.type === "moment" && item.momentId) {
      navigate(`/moments/${item.momentId}`);
    }
  };

  const typeConfig: Record<
    NotificationType,
    { icon: React.ElementType; label: string; color: string; bg: string }
  > = {
    moment: {
      icon: Camera,
      label: t("notification.moments") || "动态",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    system: {
      icon: Info,
      label: t("notification.system") || "系统",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
  };

  const tabs: { key: FilterType; label: string }[] = [
    { key: "all", label: t("notifications.tabAll") || "全部" },
    { key: "moment", label: t("notification.moments") || "动态" },
    { key: "system", label: t("notification.system") || "系统" },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2"
            data-analytics-button="notifications-back"
            data-analytics-name="通知页返回"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl text-foreground">
              {t("notifications.title") || "通知"}
            </h1>
            {unreadCount > 0 && (
              <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="divide-y divide-border">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            {t("common.loading")}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm">{t("notifications.empty") || "暂无通知"}</p>
          </div>
        )}

        {!loading &&
          filtered.map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors active:bg-secondary text-left ${
                  !item.read ? "bg-primary/5" : ""
                }`}
              >
                {/* Avatar / Icon */}
                <div className="relative flex-shrink-0">
                  {item.avatar ? (
                    <AvatarImage
                      src={item.avatar}
                      seed={item.companionId || "fallback"}
                      alt={item.title}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${config.bg}`}
                    >
                      <Icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                  )}
                  {!item.read && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-pink-500 rounded-full border-2 border-background"></span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-foreground font-medium text-sm truncate">
                      {item.title}
                    </p>
                    <span className="text-muted-foreground text-xs whitespace-nowrap ml-2">
                      {formatRelativeTime(item.time, t)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {item.content}
                  </p>
                  {item.imageUrl && (
                    <MomentImage
                      src={item.imageUrl}
                      alt=""
                      className="mt-2 w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
