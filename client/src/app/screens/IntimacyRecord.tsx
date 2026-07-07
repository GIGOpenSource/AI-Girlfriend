import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Heart, MessageCircle, TrendingUp, Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AvatarImage } from "../components/AvatarImage";
import { formatAffectionDisplay } from "../utils/formatAffection";
import { getAuthHeaders } from "../utils/authHeaders";

interface CompanionIntimacy {
  id: string;
  name: string;
  avatar: string;
  gender: string;
  affection: number;
  turns: number;
  mbti: string;
}

export function IntimacyRecord() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<CompanionIntimacy[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIntimacy = useCallback(() => {
    setLoading(true);
    fetch("/companions", { headers: getAuthHeaders() })
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
        const list = (data || [])
          .map((c: any) => ({
            id: c.profile?.id || "",
            name: c.profile?.name || "",
            avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profile?.id}`,
            gender: c.profile?.gender || "",
            affection: c.state?.affection || 0,
            turns: c.state?.turns || 0,
            mbti: c.profile?.mbti || "",
          }))
          .sort((a: CompanionIntimacy, b: CompanionIntimacy) => b.affection - a.affection);
        setCompanions(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadIntimacy();
  }, [loadIntimacy]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) loadIntimacy();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadIntimacy]);

  const getAffectionInfo = (affection: number) => {
    if (affection >= 80) return { label: t('myCompanions.soulmate'), color: "bg-pink-500", textColor: "text-pink-500" };
    if (affection >= 50) return { label: t('myCompanions.close'), color: "bg-purple-500", textColor: "text-purple-500" };
    if (affection >= 20) return { label: t('myCompanions.familiar'), color: "bg-blue-500", textColor: "text-blue-500" };
    return { label: t('myCompanions.stranger'), color: "bg-gray-400", textColor: "text-muted-foreground" };
  };

  const avgAffection =
    companions.length === 0
      ? 0
      : companions.reduce((sum, c) => sum + c.affection, 0) / companions.length;
  const topCompanion = companions[0] || null;
  const totalTurns = companions.reduce((sum, c) => sum + c.turns, 0);

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
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl text-foreground">{t('profile.intimacyRecord')}</h1>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-pink-500" />
            </div>
            <div className="text-2xl text-foreground mb-1">{formatAffectionDisplay(avgAffection)}</div>
            <div className="text-muted-foreground text-xs">{t('intimacy.avgAffection')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Award className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl text-foreground mb-1">
              {formatAffectionDisplay(topCompanion?.affection ?? 0)}
            </div>
            <div className="text-muted-foreground text-xs">{t('intimacy.highest')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl text-foreground mb-1">{totalTurns}</div>
            <div className="text-muted-foreground text-xs">{t('profile.chatTurns')}</div>
          </div>
        </div>
      </div>

      {/* Top Companion Highlight */}
      {topCompanion && (
        <div className="px-4 mb-4">
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <AvatarImage
                src={topCompanion.avatar}
                seed={topCompanion.id}
                alt={topCompanion.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-pink-500"
              />
              <div className="flex-1">
                <p className="text-foreground font-medium">{topCompanion.name}</p>
                <p className="text-muted-foreground text-xs">{t('intimacy.topCompanion')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Heart className="w-3 h-3 text-pink-500" fill="currentColor" />
                  <span className="text-pink-500 text-sm font-medium">
                    {formatAffectionDisplay(topCompanion.affection)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {getAffectionInfo(topCompanion.affection).label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-3">
        {companions.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            {t('common.noData')}
          </div>
        )}
        {companions.map((companion, index) => {
          const info = getAffectionInfo(companion.affection);
          return (
            <div
              key={companion.id}
              onClick={() => navigate(`/chat/${companion.id}`)}
              className="bg-card border border-border rounded-2xl p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <AvatarImage
                    src={companion.avatar}
                    seed={companion.id}
                    alt={companion.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 bg-card text-foreground text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-border">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground font-medium truncate">{companion.name}</h3>
                    {companion.mbti && (
                      <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                        {companion.mbti}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`${info.textColor} font-medium`}>{info.label}</span>
                    <span className="text-muted-foreground">
                      {companion.turns} {t('profile.chatTurns')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-medium ${info.textColor}`}>
                    {formatAffectionDisplay(companion.affection)}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className={`${info.color} h-full rounded-full transition-all`}
                  style={{ width: `${Math.min(companion.affection, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
