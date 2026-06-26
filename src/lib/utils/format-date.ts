import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export const formatDateZN = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "yyyy年MM月dd日", { locale: zhCN });
  } catch {
    return dateStr;
  }
};
