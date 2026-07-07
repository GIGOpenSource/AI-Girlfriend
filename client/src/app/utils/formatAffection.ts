/** 亲密度展示：四舍五入到小数点后三位，并去掉无意义的尾随 0。 */
export function formatAffectionDisplay(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
