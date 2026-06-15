/**
 * 把秒数格式化为 mm:ss
 */
// TODO: 清理该文件，已经有formatMediaTime了
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
