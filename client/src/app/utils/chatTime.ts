/** 聊天消息时间展示：随界面语言切换 locale */

export function resolveMessageLocale(lang: string): string {
  const base = (lang || "zh").split("-")[0]?.toLowerCase() || "zh";
  const map: Record<string, string> = {
    zh: "zh-CN",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
    pt: "pt-BR",
    es: "es-ES",
    id: "id-ID",
  };
  return map[base] || lang || "zh-CN";
}

export function formatMessageTime(
  isoOrDate: string | number | Date,
  lang: string
): string {
  const d =
    typeof isoOrDate === "object"
      ? isoOrDate
      : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(resolveMessageLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNowMessageTime(lang: string): string {
  return formatMessageTime(new Date(), lang);
}

function _startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 列表日期分隔：今天 / 昨天 / 其余用本地化的具体日期 */
export function formatChatDateSeparator(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sd = _startOfLocalDay(d);
  const sn = _startOfLocalDay(now);
  const diffDays = Math.round((sn - sd) / 86400000);
  const base = (lang || "zh").split("-")[0]?.toLowerCase() || "zh";
  const today: Record<string, string> = {
    zh: "今天",
    en: "Today",
    ja: "今日",
    ko: "오늘",
    pt: "Hoje",
    es: "Hoy",
    id: "Hari ini",
  };
  const yesterday: Record<string, string> = {
    zh: "昨天",
    en: "Yesterday",
    ja: "昨日",
    ko: "어제",
    pt: "Ontem",
    es: "Ayer",
    id: "Kemarin",
  };
  if (diffDays === 0) return today[base] || today.en;
  if (diffDays === 1) return yesterday[base] || yesterday.en;
  const loc = resolveMessageLocale(lang);
  if (base === "zh") {
    return d.toLocaleDateString(loc, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return d.toLocaleDateString(loc, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function calendarDayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
