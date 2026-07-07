import i18n from "../../i18n";

const ANALYTICS_API = "/api/analytics";

const ANALYTICS_LANG_CODES = ["zh", "en", "ja", "ko", "pt", "es", "id"] as const;

/** 与后台数据统计语言筛选一致（仅主语言码，避免出现 zh-CN 导致筛不出） */
function getCurrentLanguage(): string {
  let raw = "";
  if (i18n.language) {
    raw = i18n.language.split("-")[0].toLowerCase();
  } else {
    const navLang = navigator.language || (navigator as any).userLanguage;
    raw = navLang ? navLang.split("-")[0].toLowerCase() : "en";
  }
  return ANALYTICS_LANG_CODES.includes(raw as (typeof ANALYTICS_LANG_CODES)[number])
    ? raw
    : "en";
}

function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("device_id", id);
  }
  return id;
}

function getCurrentPagePath(): string {
  return window.location.pathname;
}

export function trackPageView(pagePath: string, pageName: string) {
  const deviceId = getDeviceId();
  const language = getCurrentLanguage();
  try {
    fetch(`${ANALYTICS_API}/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_path: pagePath,
        page_name: pageName,
        device_id: deviceId,
        language,
      }),
      keepalive: true,
    }).catch(() => {
      // 静默失败
    });
  } catch {
    // 静默失败
  }
}

export function trackButtonClick(
  buttonId: string,
  buttonName: string,
  pagePath?: string
) {
  const deviceId = getDeviceId();
  const path = pagePath || getCurrentPagePath();
  const language = getCurrentLanguage();
  try {
    fetch(`${ANALYTICS_API}/button-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        button_id: buttonId,
        button_name: buttonName,
        page_path: path,
        device_id: deviceId,
        language,
      }),
      keepalive: true,
    }).catch(() => {
      // 静默失败
    });
  } catch {
    // 静默失败
  }
}

// 页面路径到中文名称的映射
const PAGE_NAME_MAP: Record<string, string> = {
  "/": "登录页",
  "/register": "注册页",
  "/home": "首页",
  "/messages": "消息列表页",
  "/discover": "发现页",
  "/profile": "个人中心",
  "/chat": "聊天页",
  "/companion": "伴侣详情页",
  "/create": "创建伴侣页",
  "/feedback": "反馈页",
  "/my-companions": "我的伴侣页",
  "/intimacy-record": "亲密度记录页",
  "/my-posts": "我的帖子页",
  "/notification-settings": "通知设置页",
};

export function getPageName(path: string): string {
  // 优先精确匹配
  if (PAGE_NAME_MAP[path]) {
    return PAGE_NAME_MAP[path];
  }
  // 前缀匹配（如 /chat/xxx -> 聊天页）
  for (const [key, name] of Object.entries(PAGE_NAME_MAP)) {
    if (path.startsWith(key + "/")) {
      return name;
    }
  }
  return path;
}

// 全局按钮点击事件委托处理器
export function setupGlobalButtonTracking() {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const trackable = target.closest<HTMLElement>(
      "[data-analytics-button]"
    );
    if (trackable) {
      const buttonId = trackable.getAttribute("data-analytics-button") || "";
      const buttonName =
        trackable.getAttribute("data-analytics-name") || buttonId;
      const pagePath =
        trackable.getAttribute("data-analytics-page") ||
        getCurrentPagePath();
      if (buttonId) {
        trackButtonClick(buttonId, buttonName, pagePath);
      }
    }
  });
}
