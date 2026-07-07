import { useNavigate, useLocation } from "react-router";
import { Home, MessageCircle, Compass, User, ArrowUp } from "lucide-react";
import { useChat } from "../context/ChatContext";
import { useState, useEffect } from "react";

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCounts } = useChat();
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setScrolled(false);
  }, [location.pathname]);

  useEffect(() => {
    const readScrollTop = (e: Event): number => {
      const t = e.target;
      if (t instanceof Window) {
        return t.scrollY || t.pageYOffset || 0;
      }
      if (t === document || t === document.documentElement) {
        return (
          document.scrollingElement?.scrollTop ??
          document.documentElement.scrollTop ??
          0
        );
      }
      if (t instanceof Element) {
        return t.scrollTop;
      }
      return 0;
    };

    const handleScroll = (e: Event) => {
      setScrolled(readScrollTop(e) > 200);
    };
    // capture：可收到内部 overflow 容器的 scroll（不冒泡）；window 兜底视口滚动
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const scrollToTop = () => {
    // 优先滚动当前页面内的滚动容器
    const containers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll');
    containers.forEach((el) => {
      (el as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    });
    // 兜底：同时滚动 window
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tabs = [
    { path: "/home", icon: Home, label: "首页" },
    { path: "/messages", icon: MessageCircle, label: "消息", showBadge: true },
    { path: "/discover", icon: Compass, label: "发现" },
    { path: "/profile", icon: User, label: "我的" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50">
      <div className="flex h-full items-center justify-around px-4">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const showBackToTop = scrolled && isActive;
          const Icon = showBackToTop ? ArrowUp : tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => {
                if (showBackToTop) {
                  scrollToTop();
                } else {
                  navigate(tab.path);
                }
              }}
              className="flex flex-col items-center gap-1 transition-colors relative"
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                {!showBackToTop && tab.showBadge && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-pink-500 text-white text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </div>
              <span
                className={`text-xs ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
