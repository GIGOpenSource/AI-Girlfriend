/** 与后端 normalize_ui_language 对齐，保证 IM 的 lang 与 i18n 界面语言一致 */

const SUPPORTED = new Set(["zh", "en", "ja", "ko", "pt", "es", "id"]);
export type UiLangCode = "zh" | "en" | "ja" | "ko" | "pt" | "es" | "id";

export function normalizeUiLang(lang: string | undefined | null): UiLangCode {
  if (!lang || typeof lang !== "string") return "zh";
  const cleaned = lang.trim().replace(/_/g, "-");
  const lower = cleaned.toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  const base = cleaned.split("-")[0]?.toLowerCase() ?? "";
  if (base && SUPPORTED.has(base)) return base as UiLangCode;
  return "en";
}
