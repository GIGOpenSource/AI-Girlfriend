/**
 * WebSocket 握手后下发的「已连接到 xxx，开始聊天」类系统提示（多语言），不应展示。
 */
export function isWsConnectWelcomeNotice(text: string): boolean {
  const s = (text || "").trim();
  if (!s) return false;
  if (s.includes("已连接到") && s.includes("开始聊天吧")) return true;
  if (s.startsWith("Connected to") && s.includes("Let's chat")) return true;
  if (s.includes("に接続しました") && s.includes("お話ししましょう")) return true;
  if (s.includes("에 연결") && s.includes("이야기하자")) return true;
  if (s.startsWith("Conectado a") && s.includes("Vamos conversar")) return true;
  if (s.startsWith("Conectado a") && s.includes("¡Hablemos")) return true;
  if (s.startsWith("Terhubung dengan") && s.includes("Mari ngobrol")) return true;
  return false;
}
