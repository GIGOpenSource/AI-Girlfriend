import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bell, MessageSquare, Share2, Volume2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NotificationPrefs {
  moments: boolean;
  messages: boolean;
  system: boolean;
  sound: boolean;
  email: boolean;
}

const STORAGE_KEY = "notification_prefs";

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { moments: true, messages: true, system: true, sound: true, email: false };
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function NotificationSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const items = [
    { key: "moments" as const, icon: Share2, label: t('notification.moments'), desc: t('notification.momentsDesc') },
    { key: "messages" as const, icon: MessageSquare, label: t('notification.messages'), desc: t('notification.messagesDesc') },
    { key: "system" as const, icon: Bell, label: t('notification.system'), desc: t('notification.systemDesc') },
    { key: "sound" as const, icon: Volume2, label: t('notification.sound'), desc: t('notification.soundDesc') },
    { key: "email" as const, icon: Mail, label: t('notification.email'), desc: t('notification.emailDesc') },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" data-analytics-button="notification-settings-back" data-analytics-name="通知设置页返回">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl text-foreground">{t('profile.notificationSettings')}</h1>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-4">
        <p className="text-muted-foreground text-sm">{t('notification.tip')}</p>
      </div>

      {/* Settings List */}
      <div className="px-4 space-y-3">
        {items.map((item) => {
          const enabled = prefs[item.key];
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${enabled ? "bg-pink-500/10" : "bg-secondary"}`}>
                <Icon className={`w-5 h-5 ${enabled ? "text-pink-500" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium">{item.label}</p>
                <p className="text-muted-foreground text-xs">{item.desc}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                data-analytics-button={`notification-toggle-${item.key}`}
                data-analytics-name={`通知设置-${item.label}`}
                className={`relative w-12 h-7 rounded-full transition-colors ${enabled ? "bg-pink-500" : "bg-muted"}`}
                aria-label={item.label}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
