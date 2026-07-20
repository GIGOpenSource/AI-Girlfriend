import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { TabBar } from "../components/TabBar";
import { useTheme } from "../context/ThemeContext";
import {
  Heart,
  MessageCircle,
  Users,
  Bell,
  Globe,
  Shield,
  Info,
  LogOut,
  Edit,
  Moon,
  Sun,
  ChevronRight,
  X,
  Check,
  Lock,
  Smartphone,
  Eye,
} from "lucide-react";
import { AvatarImage } from "../components/AvatarImage";
import { normalizeMediaUrl } from "../utils/media";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  gender: string;
  sexual_orientation: string;
  age?: number | null;
  region?: string;
  occupation?: string;
  avatar_url?: string;
}

interface UserStats {
  companion_count: number;
  total_turns: number;
  days_together: number;
}

export function Profile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<UserStats>({
    companion_count: 0,
    total_turns: 0,
    days_together: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showEditName, setShowEditName] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editSexualOrientation, setEditSexualOrientation] = useState("");
  const [editGender, setEditGender] = useState("保密");
  const [editAge, setEditAge] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editOccupation, setEditOccupation] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  useEffect(() => {
    if (showErrorDialog) {
      const timer = setTimeout(() => setShowErrorDialog(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showErrorDialog]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const menuItems: { icon: React.ElementType; label: string; badge?: string; action?: () => void; requireAuth?: boolean }[] = [
    { icon: Users, label: t('profile.myCompanions'), requireAuth: true, action: () => navigate("/my-companions") },
    { icon: Heart, label: t('profile.myMoments'), requireAuth: true, action: () => navigate("/my-posts") },
    { icon: MessageCircle, label: t('profile.intimacyRecord'), requireAuth: true, action: () => navigate("/intimacy-record") },
    { icon: Bell, label: t('profile.notificationSettings'), requireAuth: true, action: () => navigate("/notification-settings") },
    { icon: Globe, label: t('profile.languagePreference'), action: () => setShowLangPicker(true) },
    { icon: Shield, label: t('profile.accountSecurity'), requireAuth: true, action: () => setShowSecurity(true) },
    { icon: Info, label: t('profile.aboutUs'), action: () => setShowAbout(true) },
  ];

  useEffect(() => {
    const token = localStorage.getItem("user_token");
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch("/api/auth/me", { headers: { "x-token": token } }).then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("user_token");
          localStorage.removeItem("user_info");
          return null;
        }
        return r.ok ? r.json() : null;
      }),
      fetch("/api/users/stats", { headers: { "x-token": token } }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([userData, statsData]) => {
        if (userData) {
          setUser({
            ...userData,
            avatar_url: userData.avatar_url || "",
            region: userData.region || "",
            occupation: userData.occupation || "",
          });
        }
        if (statsData) setStats(statsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_info");
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
      </div>
    );
  }

   return (
    <div className="min-h-screen bg-background pb-24">
      {showErrorDialog && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-lg animate-in slide-in-from-top-2">
          <div className="w-5 h-5 rounded-full bg-yellow-500 relative flex-shrink-0">
            <span className="absolute left-1/2 top-[4px] h-[8px] w-[2px] -translate-x-1/2 rounded-full bg-white" />
            <span className="absolute left-1/2 bottom-[4px] h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-white" />
            </div>
          <span className="text-foreground text-sm">{errorMsg}</span>
        </div>
      )}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <h1 className="text-xl text-foreground">{t('profile.title')}</h1>
      </div>

      <div className="px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              const token = localStorage.getItem("user_token");
              if (!file || !token || !user) return;
              setAvatarUploading(true);
              try {
                const fd = new FormData();
                fd.append("file", file);
                const up = await fetch("/api/upload/image", { method: "POST", body: fd });
                const data = await up.json();
                const url = data.url as string | undefined;
                if (!url) {
                  alert(t("profile.avatarUploadFailed"));
                  return;
                }
                const res = await fetch("/api/auth/me", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    "x-token": token,
                  },
                  body: JSON.stringify({ avatar_url: url }),
                });
                if (res.ok) {
                  const j = await res.json();
                  const savedUrl = j.avatar_url || url;
                  setUser((prev) =>
                    prev ? { ...prev, avatar_url: savedUrl } : prev
                  );
                  try {
                    const userInfoStr = localStorage.getItem("user_info");
                    if (userInfoStr) {
                      const parsed = JSON.parse(userInfoStr) as Record<string, unknown>;
                      parsed.avatar_url = savedUrl;
                      localStorage.setItem("user_info", JSON.stringify(parsed));
                    }
                  } catch {
                    /* ignore */
                  }
                } else {
                  alert(t("profile.avatarUploadFailed"));
                }
              } catch {
                alert(t("profile.avatarUploadFailed"));
              } finally {
                setAvatarUploading(false);
              }
            }}
          />
          <div className="relative">
            {user?.avatar_url ? (
              <AvatarImage
                src={normalizeMediaUrl(user.avatar_url) || user.avatar_url}
                seed={`user-${user.id}`}
                alt=""
                className="w-20 h-20 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-3xl">
                {user?.gender === "男" ? "👨" : user?.gender === "女" ? "👩" : "👤"}
              </div>
            )}
            <button
              type="button"
              disabled={!user || avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center disabled:opacity-50"
              data-analytics-button="profile-avatar-upload"
              data-analytics-name="个人中心上传头像"
            >
              {avatarUploading ? (
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" />
              ) : (
                <Edit className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl text-foreground mb-1">
                {user?.nickname || user?.username || t('profile.notLoggedIn')}
              </h2>
              {user && (
                <button
                  onClick={() => {
                    setEditNickname(user.nickname || user.username || "");
                    setEditSexualOrientation(user.sexual_orientation || "");
                    setEditGender(user.gender || "保密");
                    setEditAge(user.age != null && user.age !== undefined ? String(user.age) : "");
                    setEditRegion(user.region || "");
                    setEditOccupation(user.occupation || "");
                    setShowEditName(true);
                  }}
                  className="p-1 rounded-full hover:bg-secondary transition-colors"
                >
                  <Edit className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {user ? `${t('profile.authorId')}: ${user.id}` : t('profile.pleaseLogin')}
            </p>
            {user?.sexual_orientation && (
              <p className="text-muted-foreground text-xs mt-1">
                {t('register.sexualOrientation')}: {user.sexual_orientation === "heterosexual" ? t('register.heterosexual')
                  : user.sexual_orientation === "homosexual" ? t('register.homosexual')
                  : user.sexual_orientation === "bisexual" ? t('register.bisexual')
                  : user.sexual_orientation === "pansexual" ? t('register.pansexual')
                  : user.sexual_orientation === "asexual" ? t('register.asexual')
                  : user.sexual_orientation === "secret" ? t('register.secret')
                  : user.sexual_orientation}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{stats.companion_count}</div>
            <div className="text-muted-foreground text-xs">{t('profile.myCompanions')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{stats.total_turns}</div>
            <div className="text-muted-foreground text-xs">{t('profile.chatTurns')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl text-foreground mb-1">{stats.days_together}天</div>
            <div className="text-muted-foreground text-xs">{t('profile.daysTogether')}</div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={toggleTheme}
            data-analytics-button="profile-toggle-theme"
            data-analytics-name="个人中心切换主题"
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                {theme === "dark" ? (
                  <Moon className="w-5 h-5 text-foreground" />
                ) : (
                  <Sun className="w-5 h-5 text-foreground" />
                )}
              </div>
              <span className="text-foreground">{t('profile.darkMode')}</span>
            </div>
            <div
              className={`w-12 h-7 rounded-full transition-colors ${
                theme === "dark" ? "bg-primary" : "bg-muted"
              } relative`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  theme === "dark" ? "translate-x-6" : "translate-x-1"
                }`}
              ></div>
            </div>
          </button>

          {menuItems
            .filter((item) => !item.requireAuth || user)
            .map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => item.action?.()}
                  data-analytics-button={`profile-menu-${index}`}
                  data-analytics-name={`个人中心菜单-${item.label}`}
                  className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              );
            })}

          {user ? (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              data-analytics-button="profile-logout"
              data-analytics-name="个人中心退出登录"
              className="w-full bg-card border border-destructive/20 rounded-xl p-4 flex items-center justify-between hover:bg-destructive/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <span className="text-destructive">{t('profile.logout')}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-destructive/50" />
            </button>
          ) : (
            <button
              onClick={() => navigate("/")}
              data-analytics-button="profile-login"
              data-analytics-name="个人中心去登录"
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              {t('login.loginBtn')}
            </button>
          )}
        </div>
      </div>

      {showEditName && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
          onClick={() => setShowEditName(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground text-lg">{t('profile.editProfile')}</h3>
              <button
                onClick={() => setShowEditName(false)}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t('register.nickname')}</label>
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder={t('profile.enterNickname')}
                  maxLength={20}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t('register.gender')}</label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="男">{t('register.male')}</option>
                  <option value="女">{t('register.female')}</option>
                  <option value="保密">{t('register.secret')}</option>
                </select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t('profile.age')}</label>
                <input
                  type="number"
                  min={18}
                  max={70}
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder={t('profile.agePlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t('profile.region')}</label>
                <input
                  type="text"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  placeholder={t('profile.placeholderRegion')}
                  maxLength={120}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t('profile.occupation')}</label>
                <input
                  type="text"
                  value={editOccupation}
                  onChange={(e) => setEditOccupation(e.target.value)}
                  placeholder={t('profile.placeholderOccupation')}
                  maxLength={100}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">{t('register.sexualOrientation')}</label>
                <select
                  value={editSexualOrientation}
                  onChange={(e) => setEditSexualOrientation(e.target.value)}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="heterosexual">{t('register.heterosexual')}</option>
                  <option value="homosexual">{t('register.homosexual')}</option>
                  <option value="bisexual">{t('register.bisexual')}</option>
                  <option value="pansexual">{t('register.pansexual')}</option>
                  <option value="asexual">{t('register.asexual')}</option>
                  <option value="secret">{t('register.secret')}</option>
                </select>
              </div>
            </div>
            <button
              onClick={async () => {
                const token = localStorage.getItem("user_token");
                if (!token || !editNickname.trim() || !editAge.trim()) {
                  if (!editNickname.trim()) {
                    setErrorMsg(t('profile.enterNickname') || "请输入昵称");
                    setShowErrorDialog(true);
                   } else if (!editAge.trim()) {
                    setErrorMsg(t('profile.requiredAge') || "请输入年龄");
                    setShowErrorDialog(true);
                  }
                  return;
                }
                setEditLoading(true);
                try{
                  const trimmedAge = editAge.trim();
                  const n = parseInt(trimmedAge, 10);
                  let agePayload: number | null = null;
                  if (!Number.isNaN(n) && n >= 18 && n <= 70) {
                    agePayload = n;
                  } else {
                    setEditLoading(false);
                    setErrorMsg(t('profile.invalidAge') || "年龄必须在18-70岁之间");
                    setShowErrorDialog(true);
                    return;
                  }
                  const res = await fetch("/api/auth/me", {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      "x-token": token,
                    },
                    body: JSON.stringify({
                      nickname: editNickname.trim(),
                      sexual_orientation: editSexualOrientation,
                      gender: editGender,
                      age: agePayload,
                      region: editRegion.trim(),
                      occupation: editOccupation.trim(),
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setUser((prev) =>
                      prev
                        ? {
                            ...prev,
                            nickname: data.nickname,
                            sexual_orientation: data.sexual_orientation,
                            gender: data.gender ?? prev.gender,
                            age: data.age,
                            region: (data.region as string) || "",
                            occupation: (data.occupation as string) || "",
                          }
                        : prev
                    );
                    try {
                      const userInfoStr = localStorage.getItem("user_info");
                      const userInfo: Record<string, unknown> = userInfoStr
                        ? (JSON.parse(userInfoStr) as Record<string, unknown>)
                        : {};
                      userInfo.nickname = data.nickname;
                      userInfo.sexual_orientation = data.sexual_orientation;
                      userInfo.gender = data.gender;
                      userInfo.age = data.age;
                      userInfo.region = (data.region as string) || "";
                      userInfo.occupation = (data.occupation as string) || "";
                      localStorage.setItem("user_info", JSON.stringify(userInfo));
                    } catch {
                      /* ignore */
                    }
                    setShowEditName(false);
                  } else {
                  const errorData = await res.json().catch(() => ({}));
                  setErrorMsg(errorData.error || errorData.message || errorData.detail || t('profile.updateFailed'));
                  setShowErrorDialog(true);
                  }
                } catch {
                 setErrorMsg(t('common.networkError'));
                 setShowErrorDialog(true);
                } finally {
                  setEditLoading(false);
                }
              }}
              disabled={editLoading || !editNickname.trim()|| !editAge.trim()}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {editLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showLangPicker && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center px-0 sm:px-4"
          onClick={() => setShowLangPicker(false)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm mb-16 sm:mb-0 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground text-lg">{t('profile.selectLanguage')}</h3>
              <button
                onClick={() => setShowLangPicker(false)}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { code: 'zh', label: '中文', flag: '🇨🇳' },
                { code: 'en', label: 'English', flag: '🇺🇸' },
                { code: 'ja', label: '日本語', flag: '🇯🇵' },
                { code: 'ko', label: '한국어', flag: '🇰🇷' },
                { code: 'pt', label: 'Português', flag: '🇧🇷' },
                { code: 'es', label: 'Español', flag: '🇪🇸' },
                { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    setShowLangPicker(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    i18n.language === lang.code
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-secondary/50 border border-transparent'
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="text-foreground flex-1 text-left">{lang.label}</span>
                  {i18n.language === lang.code && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}



      {/* 关于我们弹窗 */}
      {showAbout && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground text-lg">{t('profile.aboutUs')}</h3>
              <button
                onClick={() => setShowAbout(false)}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full">
                  <Heart className="w-8 h-8 text-white" fill="white" />
                </div>
              </div>
              <p className="text-center text-foreground font-medium">{t('home.title')}</p>
              <p className="text-center">trandsai</p>
              <p className="text-center">支持多语言 · 多智能体 · 沉浸式聊天</p>
              <div className="border-t border-border pt-3 mt-3 text-center text-xs">
                <p>© 2025 trandsai. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 账号与安全弹窗 */}
      {showSecurity && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
          onClick={() => setShowSecurity(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground text-lg">{t('profile.accountSecurity')}</h3>
              <button
                onClick={() => setShowSecurity(false)}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="border-b border-border pb-3">
                <p className="text-center text-foreground font-medium">账号与安全</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>密码保护</span>
                  </div>
                  <span className="text-xs text-primary">已开启</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>登录设备</span>
                  </div>
                  <span className="text-xs">1台设备</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>隐私设置</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              <div className="border-t border-border pt-3 mt-3 text-center text-xs">
                <p>© 2025 trandsai. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 退出登录二次确认 */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.logout')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.logoutConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TabBar />
    </div>
  );
}
