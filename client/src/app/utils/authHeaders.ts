/** 与后端 REST（x-token）一致的认证头 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("user_token");
  if (!token) return {};
  return { "x-token": token };
}
