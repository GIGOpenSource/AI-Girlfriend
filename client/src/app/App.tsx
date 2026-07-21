import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider } from "./context/ChatContext";
import { ToastProvider } from "./context/ToastContext";

export default function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}