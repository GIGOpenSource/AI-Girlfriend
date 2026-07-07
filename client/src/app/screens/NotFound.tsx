import { useNavigate } from "react-router";
import { Home, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-muted-foreground/20 mb-4">404</div>
        <h1 className="text-2xl text-foreground font-medium mb-2">
          {t('notFound.title')}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          {t('notFound.desc')}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-foreground hover:bg-card transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('notFound.back')}
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 transition-opacity"
          >
            <Home className="w-4 h-4" />
            {t('notFound.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
