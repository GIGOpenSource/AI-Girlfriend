import { createBrowserRouter, Outlet, redirect, useLocation } from "react-router";
import { lazy, Suspense, useEffect } from "react";
import {
  getPageName,
  setupGlobalButtonTracking,
  trackPageView,
} from "./utils/analytics";

// 不需要登录就能访问的路由
const PUBLIC_PATHS = ["/", "/login", "/register"];

// 路由守卫：未登录自动跳转到登录页
function authGuardLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 公开路由直接放行
  if (PUBLIC_PATHS.includes(path)) {
    return null;
  }

  // 已登录放行
  const token = localStorage.getItem("user_token");
  if (token) {
    return null;
  }

  // 未登录 → 重定向到登录页
  return redirect("/");
}

const Login = lazy(() =>
  import("./screens/Login").then((m) => ({ default: m.Login }))
);
const Register = lazy(() =>
  import("./screens/Register").then((m) => ({ default: m.Register }))
);
const Home = lazy(() =>
  import("./screens/Home").then((m) => ({ default: m.Home }))
);
const Messages = lazy(() =>
  import("./screens/Messages").then((m) => ({ default: m.Messages }))
);
const Discover = lazy(() =>
  import("./screens/Discover").then((m) => ({ default: m.Discover }))
);
const PostDetail = lazy(() =>
  import("./screens/PostDetail").then((m) => ({ default: m.PostDetail }))
);
const MomentDetail = lazy(() =>
  import("./screens/MomentDetail").then((m) => ({ default: m.MomentDetail }))
);
const Profile = lazy(() =>
  import("./screens/Profile").then((m) => ({ default: m.Profile }))
);
const Chat = lazy(() =>
  import("./screens/Chat").then((m) => ({ default: m.Chat }))
);
const CreateCompanion = lazy(() =>
  import("./screens/CreateCompanion").then((m) => ({ default: m.CreateCompanion }))
);
const CompanionProfile = lazy(() =>
  import("./screens/CompanionProfile").then((m) => ({ default: m.CompanionProfile }))
);
const FeedbackChat = lazy(() =>
  import("./screens/FeedbackChat").then((m) => ({ default: m.FeedbackChat }))
);
const MyCompanions = lazy(() =>
  import("./screens/MyCompanions").then((m) => ({ default: m.MyCompanions }))
);
const IntimacyRecord = lazy(() =>
  import("./screens/IntimacyRecord").then((m) => ({ default: m.IntimacyRecord }))
);
const NotificationSettings = lazy(() =>
  import("./screens/NotificationSettings").then((m) => ({ default: m.NotificationSettings }))
);
const Notifications = lazy(() =>
  import("./screens/Notifications").then((m) => ({ default: m.Notifications }))
);
const NotFound = lazy(() =>
  import("./screens/NotFound").then((m) => ({ default: m.NotFound }))
);
const MyPosts = lazy(() =>
  import("./screens/MyPosts").then((m) => ({ default: m.MyPosts }))
);

function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname, getPageName(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    setupGlobalButtonTracking();
  }, []);

  return (
    // 全局窄容器：Web 端居中变窄、两侧留白；移动端屏宽 < 672px 时 max-w-2xl 不生效
    <div className="mx-auto max-w-2xl min-h-screen bg-background">
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    loader: authGuardLoader,
    children: [
      { index: true, Component: Login },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "home", Component: Home },
      { path: "messages", Component: Messages },
      { path: "discover", Component: Discover },
      { path: "discover/post/:postId", Component: PostDetail },
      { path: "moments/:momentId", Component: MomentDetail },
      { path: "profile", Component: Profile },
      { path: "chat/:companionId", Component: Chat },
      { path: "companion/:companionId", Component: CompanionProfile },
      { path: "create", Component: CreateCompanion },
      { path: "feedback", Component: FeedbackChat },
      { path: "my-companions", Component: MyCompanions },
      { path: "intimacy-record", Component: IntimacyRecord },
      { path: "my-posts", Component: MyPosts },
      { path: "notifications", Component: Notifications },
      { path: "notification-settings", Component: NotificationSettings },
      { path: "*", Component: NotFound },
    ],
  },
]);
