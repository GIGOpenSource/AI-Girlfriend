import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MessageCircle, Heart, MapPin, Sparkles, UserMinus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AvatarImage } from "../components/AvatarImage";
import { sortCompanionsByUserLang } from "../utils/companionLang";
import { formatAffectionDisplay } from "../utils/formatAffection";
import { getAuthHeaders } from "../utils/authHeaders";

interface CompanionItem {
  id: string;
  name: string;
  avatar: string;
  gender: string;
  city: string;
  personality: string;
  mbti: string;
  affection: number;
  turns: number;
  mood: string;
  createdBy: string;
  avatar_generating?: boolean;
}

const MY_COMPANIONS_HIDDEN_KEY = "my_companions_hidden_ids";

function loadHiddenCompanionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(MY_COMPANIONS_HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** 仅统计与首页「恋人条」一致：有过对话的智能体 */
// function hasChattedCompanion(c: { state?: { turns?: number }; last_message?: string | null }) {
//   return (c.state?.turns ?? 0) > 0 || Boolean(c.last_message);
// }
/** 临时：展示所有智能体（不按是否对话过滤），后期复原请取消上面注释 */
function hasChattedCompanion(c: { state?: { turns?: number }; last_message?: string | null }) {
  return true;
}

export function MyCompanions() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadHiddenCompanionIds());

  useEffect(() => {
    let uid = "";
    try {
      const userInfoStr = localStorage.getItem("user_info");
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        uid = userInfo.nickname || userInfo.username || "";
      }
    } catch {}
    if (!uid) {
      uid = localStorage.getItem("device_id") || "";
    }
    setCurrentUserId(uid);
  }, []);

  useEffect(() => {
    fetch(`/companions?${new URLSearchParams({ filter_type: "affectionate" }).toString()}`, { headers: getAuthHeaders() })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("user_token");
          localStorage.removeItem("user_info");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const userLang = i18n.language || "zh";
        const sorted = sortCompanionsByUserLang(data || [], userLang);
        const chattedOnly = sorted.filter((c: any) => hasChattedCompanion(c));
        const list = chattedOnly.map((c: any) => ({
          id: c.profile?.id || "",
          name: c.profile?.name || "",
          avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profile?.id}`,
          gender: c.profile?.gender || "",
          city: c.profile?.city || "",
          personality: c.profile?.personality || "",
          mbti: c.profile?.mbti || "",
          affection: c.state?.affection || 0,
          turns: c.state?.turns || 0,
          mood: c.state?.mood || "",
          createdBy: c.profile?.created_by || "",
          avatar_generating: c.avatar_generating,
        }));
        setCompanions(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [i18n.language]);

  const visibleCompanions = companions.filter((c) => !hiddenIds.has(c.id));

  const hideFromList = (id: string) => {
    if (!confirm(t("myCompanions.removeConfirm"))) return;
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(MY_COMPANIONS_HIDDEN_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const getAffectionLevel = (affection: number) => {
    if (affection >= 80) return { label: t('myCompanions.soulmate'), color: "text-pink-500" };
    if (affection >= 50) return { label: t('myCompanions.close'), color: "text-purple-500" };
    if (affection >= 20) return { label: t('myCompanions.familiar'), color: "text-blue-500" };
    return { label: t('myCompanions.stranger'), color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" data-analytics-button="my-companions-back" data-analytics-name="我的伴侣页返回">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl text-foreground">{t('profile.myCompanions')}</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{visibleCompanions.length}</div>
            <div className="text-muted-foreground text-xs">{t('myCompanions.total')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">
              {visibleCompanions.reduce((sum, c) => sum + c.affection, 0).toFixed(2)}
            </div>
            <div className="text-muted-foreground text-xs">{t('myCompanions.totalAffection')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">
              {visibleCompanions.reduce((sum, c) => sum + c.turns, 0)}
            </div>
            <div className="text-muted-foreground text-xs">{t('profile.chatTurns')}</div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-4 space-y-3">
        {visibleCompanions.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            {t('common.noData')}
          </div>
        )}
        {visibleCompanions.map((companion) => {
          const affectionInfo = getAffectionLevel(companion.affection);
          return (
            <div
              key={companion.id}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="relative">
                {companion.avatar_generating ? (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
                  </div>
                ) : (
                  <AvatarImage
                    src={companion.avatar}
                    seed={companion.id}
                    alt={companion.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                {companion.gender === "男" && (
                  <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">♂</span>
                )}
                {companion.gender === "女" && (
                  <span className="absolute -bottom-1 -right-1 bg-pink-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">♀</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-foreground font-medium truncate">{companion.name}</h3>
                  {companion.mbti && (
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                      {companion.mbti}
                    </span>
                  )}
                  {companion.createdBy && companion.createdBy === currentUserId && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                      自己创建
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                  {companion.city && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {companion.city}
                    </span>
                  )}
                  {companion.mood && (
                    <span className="flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" />
                      {companion.mood}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`flex items-center gap-0.5 ${affectionInfo.color}`}>
                    <Heart className="w-3 h-3" fill="currentColor" />
                    {formatAffectionDisplay(companion.affection)}
                  </span>
                  <span className="text-muted-foreground">{affectionInfo.label}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigate(`/chat/${companion.id}`)}
                  data-analytics-button={`my-companions-chat-${companion.id}`}
                  data-analytics-name={`我的伴侣页聊天-${companion.name}`}
                  className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => hideFromList(companion.id)}
                  data-analytics-button={`my-companions-remove-${companion.id}`}
                  data-analytics-name={`我的伴侣页移出列表-${companion.name}`}
                  className="p-2 rounded-full border border-border text-muted-foreground hover:bg-secondary"
                  title={t("myCompanions.removeFromList")}
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
