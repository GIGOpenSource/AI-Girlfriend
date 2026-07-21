import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

const PRIVACY_URL = "https://www.trandsai.com/agreement/Trands%20-%20Ai%20Privacy%20Policy.html";

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部导航栏 */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg text-foreground font-medium">隐私协议</h1>
      </div>

      {/* WebView */}
      <iframe
        src={PRIVACY_URL}
        className="flex-1 w-full border-0"
        title="隐私协议"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
