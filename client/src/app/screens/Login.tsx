import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Heart } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError(t('login.errorEmpty'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t('login.errorFailed'));
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full mb-4">
            <Heart className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="text-3xl text-foreground mb-2">{t('home.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="text-destructive text-sm text-center">{error}</div>
          )}

          <div>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder={t('login.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t('login.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-analytics-button="login-submit"
            data-analytics-name="登录页登录按钮"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl transition-all active:scale-95 disabled:opacity-60"
          >
            {loading ? t('login.loggingIn') : t('login.loginBtn')}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/register")}
            data-analytics-button="login-to-register"
            data-analytics-name="登录页去注册"
            className="text-muted-foreground text-sm"
          >
            {t('login.noAccount')}<span className="text-primary ml-1">{t('login.registerBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
