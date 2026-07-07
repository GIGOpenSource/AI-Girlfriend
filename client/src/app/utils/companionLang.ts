// 城市到语言的映射（与 CreateCompanion.tsx 中的 citiesByLang 对应）
const citiesByLang: Record<string, string[]> = {
  zh: ["北京", "上海", "成都", "广州", "深圳", "杭州", "武汉", "西安"],
  en: ["New York", "Los Angeles", "London", "San Francisco", "Seattle", "Chicago", "Boston", "Austin"],
  ja: ["東京", "大阪", "京都", "札幌", "福岡", "名古屋", "横浜", "神戸"],
  ko: ["서울", "부산", "인천", "대구", "광주", "대전", "울산", "제주"],
  pt: ["São Paulo", "Rio de Janeiro", "Salvador", "Brasília", "Belo Horizonte", "Fortaleza", "Curitiba", "Porto Alegre"],
  es: ["Madrid", "Barcelona", "México City", "Buenos Aires", "Lima", "Bogotá", "Santiago", "Valencia"],
  id: ["Jakarta", "Surabaya", "Bandung", "Medan", "Makassar", "Yogyakarta", "Semarang", "Bali"],
};

// 构建 city -> lang 的反向映射
const cityToLangMap: Record<string, string> = {};
Object.entries(citiesByLang).forEach(([lang, cities]) => {
  cities.forEach((city) => {
    cityToLangMap[city] = lang;
  });
});

/**
 * 根据城市名称推断 Companion 的语言
 * 与后端 culture_data.py::infer_language_from_city 保持一致
 * 用于确保机器人 profile.language 与其地区（city）信息严格一致
 * @param city 城市名称
 * @returns 语言代码（zh/en/ja/ko/pt/es/id），无法推断时返回 "zh"
 */
export function inferCompanionLanguage(city: string): string {
  if (!city) return "zh";
  const cityLower = city.trim().toLowerCase();
  return cityToLangMap[city] || 
         (["北京", "上海", "成都", "广州", "深圳", "杭州", "武汉", "西安", "南京", "重庆"].some(c => 
           cityLower.includes(c.toLowerCase()) || c.toLowerCase().includes(cityLower)) ? "zh" : "zh");
}

/**
 * 根据用户当前语言对 Companion 列表进行排序
 * 匹配的排在前面，未匹配的保持原有顺序
 * @param companions Companion 列表
 * @param userLang 用户当前语言
 * @returns 排序后的列表
 */
export function sortCompanionsByUserLang(
  companions: any[],
  userLang: string
): any[] {
  const targetLang = userLang?.split("-")[0] || userLang || "zh";
  return [...companions].sort((a, b) => {
    // 优先使用 companion 的 language 字段，不存在时回退到 city 推断
    const langA = a.profile?.language || inferCompanionLanguage(a.profile?.city || "");
    const langB = b.profile?.language || inferCompanionLanguage(b.profile?.city || "");
    const matchA = langA === targetLang ? 1 : 0;
    const matchB = langB === targetLang ? 1 : 0;
    return matchB - matchA;
  });
}
