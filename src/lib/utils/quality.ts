export const QUALITY_OPTIONS = [
  { value: "128", label: "标准 (128kbps)" },
  { value: "192", label: "高品 (192kbps)" },
  { value: "320", label: "极高 (320kbps)" },
  { value: "999", label: "无损 (999kbps)" },
] as const;

export function getQualityLabel(value: string): string {
  return QUALITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getQualityShortLabel(value: string): string {
  const label = QUALITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return label.split(" ")[0] + "音质";
}
