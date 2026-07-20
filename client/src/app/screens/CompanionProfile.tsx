import { useParams, useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, MessageCircle, Calendar, Settings, Trash2, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MomentImage } from "../components/MomentImage";
import { translatePersonalityTag } from "../utils/personalityTags";
import { getAuthHeaders } from "../utils/authHeaders";
import apiFetch from "../utils/api";
import { formatAffectionDisplay } from "../utils/formatAffection";

interface CompanionData {
  profile: {
    id: string;
    name: string;
    age: number;
    gender: string;
    city: string;
    personality: string;
    background: string;
    speech_style: string;
    hobbies: string;
    values: string;
    fears: string;
    love_view: string;
    daily_routine: string;
    favorite_things: string;
    mbti: string;
    sexual_orientation: string;
    created_by: string;
    created_at: string;
  };
  state: {
    affection: number;
    turns: number;
  };
  avatar: string;
  avatar_generating?: boolean;
}

interface MomentItem {
  id: number;
  image_url: string;
  image_generating?: boolean;
  caption: string;
  likes_count: number;
  comments_count: number;
  liked?: boolean;
  created_at: string;
}

export function CompanionProfile() {
  const { t, i18n } = useTranslation();
  const { companionId } = useParams<{ companionId: string }>();
  const navigate = useNavigate();
  const [companion, setCompanion] = useState<CompanionData | null>(null);
  const [momentsCount, setMomentsCount] = useState(0);
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"about" | "moments">("about");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!companionId) return;

    fetch(`/companions/${companionId}`, { headers: getAuthHeaders() })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("user_token");
          localStorage.removeItem("user_info");
          navigate("/");
          return null;
        }
        if (r.status === 403) {
          throw new Error("forbidden");
        }
        if (!r.ok) throw new Error("加载失败");
        return r.json();
      })
      .then((data) => {
        if (data) setCompanion(data);
        console.log("data",data)
      })
      .catch((err) => {
        console.error("加载智能体资料失败:", err);
        setError(t('companionProfile.loadingError'));
      })
      .finally(() => setLoading(false));

    apiFetch(`/api/companions/${companionId}/moments`)
      .then((data: any) => {
        setMomentsCount(data.total || 0);
        setMoments(data.moments || []);
      })
      .catch((err: any) => {
        console.error("加载Moments失败:", err);
      });
  }, [companionId, navigate, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
      </div>
    );
  }

  if (error || !companion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{error || t('companionProfile.notFound')}</div>
      </div>
    );
  }

  const profile = companion.profile;

  /** 与后端 _assert_companion_user_access 一致：可与 created_by 比对的当前用户标识 */
  const getCurrentUserCreatorKeys = (): string[] => {
    const keys: string[] = [];
    try {
      const userInfoStr = localStorage.getItem("user_info");
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        if (userInfo.id != null && userInfo.id !== "") {
          keys.push(String(userInfo.id));
        }
        const nick = String(userInfo.nickname || "").trim();
        const uname = String(userInfo.username || "").trim();
        if (nick) keys.push(nick);
        if (uname) keys.push(uname);
      }
    } catch {
      /* ignore */
    }
    const deviceId = localStorage.getItem("device_id") || "";
    if (deviceId) keys.push(deviceId);
    return [...new Set(keys.filter(Boolean))];
  };

  const createdBy = (profile.created_by || "").trim();
  const isCreator = Boolean(createdBy && getCurrentUserCreatorKeys().includes(createdBy));
  const personalities = profile.personality
    ? profile.personality.split(/[、,，]/).filter(Boolean)
    : [];
  const createdAt = profile.created_at ? new Date(profile.created_at) : new Date();
  const daysTogether = Math.floor(
    (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const InfoCard = ({
    icon,
    title,
    content,
  }: {
    icon: React.ReactNode;
    title: string;
    content: string;
  }) => {
    if (!content) return null;
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="text-foreground mb-3 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{content}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" data-analytics-button="companion-profile-back" data-analytics-name="伴侣详情页返回">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-lg text-foreground">{profile.name}</h1>
          <div className="relative" ref={menuRef}>
            <button
              className="p-2 -mr-2"
              data-analytics-button="companion-profile-menu"
              data-analytics-name="伴侣详情页设置菜单"
              onClick={() => setShowMenu((v) => !v)}
            >
              <Settings className="w-6 h-6 text-foreground" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 w-40 z-50">
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                  data-analytics-button="companion-profile-clear-messages"
                  data-analytics-name="伴侣详情页清空消息"
                  onClick={async () => {
                    setShowMenu(false);
                    if (!companionId) return;
                    if (!confirm(t('chat.confirmClearMessages'))) return;
                    try {
                      const res = await fetch(
                        `/companions/${companionId}/clear-messages`,
                        { method: "POST", headers: getAuthHeaders() }
                      );
                      if (res.status === 401) {
                        localStorage.removeItem("user_token");
                        localStorage.removeItem("user_info");
                        navigate("/");
                        return;
                      }
                      if (res.ok) {
                        setCompanion((prev) =>
                          prev
                            ? { ...prev, state: { ...prev.state, affection: 0 } }
                            : prev
                        );
                        alert(t('chat.clearSuccess'));
                      } else {
                        alert(t('chat.clearFailed'));
                      }
                    } catch {
                      alert(t('chat.clearFailed'));
                    }
                  }}
                >
                  {t('chat.clearMessages')}
                </button>
                {isCreator && (
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors"
                  data-analytics-button="companion-profile-delete"
                  data-analytics-name="伴侣详情页删除伴侣"
                  onClick={async () => {
                    setShowMenu(false);
                    if (!confirm(t('companionProfile.deleteConfirm'))) return;
                    try {
                      const res = await fetch(`/companions/${companionId}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                      });
                      if (res.status === 401) {
                        localStorage.removeItem("user_token");
                        localStorage.removeItem("user_info");
                        navigate("/");
                        return;
                      }
                      if (res.ok) {
                        navigate("/messages");
                      } else {
                        alert(t('companionProfile.deleteFailed'));
                      }
                    } catch {
                      alert(t('companionProfile.deleteFailed'));
                    }
                  }}
                >
                  {t('companionProfile.deleteCompanion')}
                </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            {companion.avatar_generating ? (
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
              </div>
            ) : (
              <img
                src={companion.avatar}
                alt={profile.name}
                className="w-32 h-32 rounded-full object-cover"
              />
            )}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-4 py-1 rounded-full text-sm">
              {formatAffectionDisplay(companion.state.affection)}
            </div>
          </div>

          <h2 className="text-2xl text-foreground mb-2">{profile.name}</h2>
          <p className="text-muted-foreground text-sm">
            {profile.age}{t('companionProfile.ageUnit')} · {profile.gender} · {profile.city}
          </p>
          {profile.mbti && (
            <span className="mt-2 px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm">
              {profile.mbti}
            </span>
          )}
          {profile.sexual_orientation && (
            <span className="mt-2 px-3 py-1 bg-purple-500/10 text-purple-500 rounded-full text-sm">
              {t(`companionProfile.sexualOrientation.${profile.sexual_orientation}` as any)}
            </span>
          )}

          <div className="flex gap-2 mt-3 flex-wrap justify-center">
            {personalities.map((p) => (
              <span
                key={p}
                className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
              >
                {translatePersonalityTag(p.trim(), i18n.language)}
              </span>
            ))}
          </div>

          <div className="flex gap-3 mt-6 w-full max-w-xs">
                <button
                  onClick={() => navigate(`/chat/${companionId}`)}
                  data-analytics-button="companion-profile-chat"
                  data-analytics-name="伴侣详情页开始聊天"
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-full flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  {t('companionProfile.sendMessage')}
                </button>
                {!isCreator && (
                  <button
                    onClick={() => {
                      const cloneData = {
                        name: profile.name,
                        age: profile.age,
                        gender: profile.gender === "男" ? "male" : "female",
                        city: profile.city,
                        personality: profile.personality,
                        background: profile.background,
                        speech_style: profile.speech_style,
                        hobbies: profile.hobbies,
                        values: profile.values,
                        fears: profile.fears,
                        love_view: profile.love_view,
                        daily_routine: profile.daily_routine,
                        favorite_things: profile.favorite_things,
                        mbti: profile.mbti,
                        sexual_orientation: profile.sexual_orientation,
                        life_story: (profile as any).life_story || "",
                        cultural_values: (profile as any).cultural_values || "",
                        gender_perspective: (profile as any).gender_perspective || "",
                      };
                      localStorage.setItem("clone_companion_data", JSON.stringify(cloneData));
                      navigate("/create?clone=1");
                    }}
                    className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-full flex items-center justify-center gap-2 border border-border"
                    data-analytics-button="companion-profile-clone"
                    data-analytics-name="伴侣详情页克隆伴侣"
                  >
                    <Copy className="w-5 h-5" />
                    {t('companionProfile.clone')}
                  </button>
                )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{companion.state.turns}</div>
            <div className="text-muted-foreground text-xs">{t('companionProfile.chatTurns')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{momentsCount}</div>
            <div className="text-muted-foreground text-xs">Moments</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{daysTogether}</div>
            <div className="text-muted-foreground text-xs">{t('companionProfile.daysTogether')}</div>
          </div>
        </div>

        {/* 标签切换 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("about")}
            data-analytics-button="companion-profile-tab-about"
            data-analytics-name="伴侣详情页关于Tab"
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === "about"
                ? "text-foreground border-b-2 border-pink-500"
                : "text-muted-foreground"
            }`}
          >
            {t('companionProfile.about')}
          </button>
          <button
            onClick={() => setActiveTab("moments")}
            data-analytics-button="companion-profile-tab-moments"
            data-analytics-name="伴侣详情页朋友圈Tab"
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === "moments"
                ? "text-foreground border-b-2 border-pink-500"
                : "text-muted-foreground"
            }`}
          >
            {t('companionProfile.momentsTab')}
          </button>
        </div>

        {activeTab === "about" && (
          <div className="space-y-4">
            <InfoCard icon={<span>📖</span>} title={t('companionProfile.background')} content={profile.background} />
            <InfoCard icon={<span>💬</span>} title={t('companionProfile.speechStyle')} content={profile.speech_style} />
            {profile.mbti && (
              <InfoCard icon={<span>🔮</span>} title={t('companionProfile.mbti')} content={profile.mbti} />
            )}
            {profile.sexual_orientation && (
              <InfoCard
                icon={<span>🏳️‍🌈</span>}
                title={t('companionProfile.sexualOrientationLabel')}
                content={t(`companionProfile.sexualOrientation.${profile.sexual_orientation}` as any)}
              />
            )}
            {createdBy && (
              <InfoCard
                icon={<span>✍️</span>}
                title={t('companionProfile.creator')}
                content={profile.created_by}
              />
            )}
            <InfoCard icon={<span>🎨</span>} title={t('companionProfile.hobbies')} content={profile.hobbies} />
            <InfoCard icon={<span>💎</span>} title={t('companionProfile.values')} content={profile.values} />
            <InfoCard icon={<span>🛡️</span>} title={t('companionProfile.fears')} content={profile.fears} />
            <InfoCard icon={<span>💕</span>} title={t('companionProfile.loveView')} content={profile.love_view} />
            <InfoCard icon={<span>☀️</span>} title={t('companionProfile.dailyRoutine')} content={profile.daily_routine} />
            <InfoCard icon={<span>🌟</span>} title={t('companionProfile.favoriteThings')} content={profile.favorite_things} />

            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                {t('companionProfile.meetTime')}
              </h3>
              <p className="text-muted-foreground text-sm">
                {createdAt.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        )}

        {activeTab === "moments" && (
          <div className="space-y-4">
            {moments.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-12">
                {t('companionProfile.noMoments')}
              </div>
            ) : (
              moments.map((m) => (
                <div
                  key={m.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  {m.image_generating ? (
                    <div className="w-full h-48 bg-muted flex flex-col items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="text-muted-foreground text-xs">图片生成中...</span>
                    </div>
                  ) : (
                    <MomentImage
                      src={m.image_url}
                      alt="moment"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <p className="text-foreground text-sm mb-3">{m.caption}</p>
                    <div className="flex items-center gap-4 text-muted-foreground text-xs">
                      <span className="flex items-center gap-1">
                        <span className={m.liked ? "text-pink-500" : "text-muted-foreground"}>{m.liked ? "❤️" : "🤍"}</span> {m.likes_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <span>💬</span> {m.comments_count}
                      </span>
                      <span>
                        {new Date(m.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isCreator && (
          <button
            onClick={async () => {
              if (!confirm(t('companionProfile.deleteConfirm'))) return;
              try {
                const res = await fetch(`/companions/${companionId}`, {
                  method: "DELETE",
                  headers: getAuthHeaders(),
                });
                if (res.status === 401) {
                  localStorage.removeItem("user_token");
                  localStorage.removeItem("user_info");
                  navigate("/");
                  return;
                }
                if (res.ok) {
                  navigate("/messages");
                } else {
                  alert(t('companionProfile.deleteFailed'));
                }
              } catch {
                alert(t('companionProfile.deleteFailed'));
              }
            }}
            className="w-full bg-destructive/10 text-destructive py-3 rounded-full flex items-center justify-center gap-2 border border-destructive/20"
            data-analytics-button="companion-profile-delete-footer"
            data-analytics-name="伴侣详情页底部删除伴侣"
          >
            <Trash2 className="w-5 h-5" />
            {t('companionProfile.deleteCompanion')}
          </button>
        )}
      </div>
    </div>
  );
}