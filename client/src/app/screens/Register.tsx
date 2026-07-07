import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";

export function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [gender, setGender] = useState<"male" | "female" | "secret">("secret");
  const [sexualOrientation, setSexualOrientation] = useState("heterosexual");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || username.trim().length < 3) {
      setError(t('register.errorUsername'));
      return;
    }
    if (!password || password.length < 6) {
      setError(t('register.errorPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('register.errorConfirm'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          nickname: nickname.trim() || username.trim(),
          password,
          gender: gender === "male" ? "男" : gender === "female" ? "女" : "保密",
          sexual_orientation: sexualOrientation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t('register.errorFailed'));
        return;
      }
      localStorage.setItem("user_token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.user));
      navigate("/home");
    } catch {
      setError(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full mb-4">
            <Heart className="w-8 h-8 text-white" fill="white" />
          </div>
          <h1 className="text-2xl text-foreground mb-2">{t('register.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('register.subtitle')}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 max-w-sm mx-auto">
          {error && (
            <div className="text-destructive text-sm text-center">{error}</div>
          )}

          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder={t('register.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <input
            id="register-nickname"
            name="nickname"
            type="text"
            autoComplete="nickname"
            placeholder={t('register.nickname')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <input
            id="register-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder={t('register.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <input
            id="register-confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder={t('register.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <div>
            <p className="text-muted-foreground text-sm mb-3">{t('register.gender')}</p>
            <div className="flex gap-3">
              {[
                { value: "male", label: t('register.male') },
                { value: "female", label: t('register.female') },
                { value: "secret", label: t('register.secret') },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGender(option.value as any)}
                  className={`flex-1 py-3 rounded-xl transition-all ${
                    gender === option.value
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-sm mb-3">{t('register.sexualOrientation')}</p>
            <select
              value={sexualOrientation}
              onChange={(e) => setSexualOrientation(e.target.value)}
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

          <button
            type="submit"
            disabled={loading}
            data-analytics-button="register-submit"
            data-analytics-name="注册页注册按钮"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl transition-all active:scale-95 mt-6 disabled:opacity-60"
          >
            {loading ? t('register.registering') : t('register.registerBtn')}
          </button>

          <div className="text-center text-muted-foreground text-xs pt-4">
            {t('register.agree')} <button className="text-primary">{t('register.terms')}</button>
            {t('register.and')}<button className="text-primary">{t('register.privacy')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
