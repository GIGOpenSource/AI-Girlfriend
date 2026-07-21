import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface Toast {
  id: number;
  message: string;
}

interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

/**
 * 全局 toast 函数 - 供非 React 代码（如 api.ts）直接调用。
 * 通过自定义事件触发，ToastProvider 会监听并渲染 toast。
 */
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message } }));
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, 3000);
    timersRef.current.set(id, timer);
  }, []);

  // 监听全局 toast 事件（供 api.ts 等非 React 代码使用）
  useEffect(() => {
    const handler = (e: Event) => {
      const { message } = (e as CustomEvent).detail;
      addToast(message);
    };
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, [addToast]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast 容器 - 固定在顶部居中 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-lg animate-in slide-in-from-top-2 fade-in duration-300"
          >
            <span className="text-foreground text-sm">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="p-0.5 rounded-full hover:bg-secondary transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // 非 React 环境或尚未挂载 Provider 时降级为浏览器 alert
    return { toast: (msg: string) => alert(msg) };
  }
  return ctx;
}
