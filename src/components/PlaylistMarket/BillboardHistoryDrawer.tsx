import { useState } from "react";
import { Calendar, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketSession } from "@/store/session/market-session";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const MIN_YEAR = 1960;

function getSaturdays(year: number, month: number): number[] {
  const now = new Date();
  const maxDay =
    year === now.getFullYear() && month === now.getMonth() + 1
      ? now.getDate()
      : new Date(year, month, 0).getDate();

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  let firstSat = ((6 - firstDayOfWeek + 7) % 7) + 1;

  const days: number[] = [];
  while (firstSat <= maxDay) {
    days.push(firstSat);
    firstSat += 7;
  }
  return days;
}

export function BillboardHistoryDrawer() {
  // ✅ 修正：按需分开获取或传入 shallow 比对，避免对象字面量导致死循环
  const billboardDate = useMarketSession((s) => s.billboardDate);
  const setBillboardDate = useMarketSession((s) => s.setBillboardDate);

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [ym, setYm] = useState(currentYm);
  const [open, setOpen] = useState(false);

  const [year, month] = ym.split("-").map(Number);
  const saturdays = getSaturdays(year, month);

  const pick = (day: number) => {
    const iso = `${ym}-${String(day).padStart(2, "0")}`;
    setBillboardDate(iso);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label="历史周榜"
          className={cn(
            "flex h-8 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition-colors active:scale-95",
            billboardDate ? "gap-1 px-2.5" : "w-8"
          )}
        >
          <Calendar className="h-4 w-4" />
          {billboardDate && (
            <span className="text-xs font-medium tabular-nums">
              {billboardDate.replace(/-/g, "/")}
            </span>
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[75vh]">
        <DrawerHeader className="flex items-center justify-between px-4 pb-2 pt-3">
          <DrawerTitle className="text-base font-semibold">
            历史周榜
          </DrawerTitle>
          <input
            type="month"
            value={ym}
            min={`${MIN_YEAR}-01`}
            max={currentYm}
            onChange={(e) => e.target.value && setYm(e.target.value)}
            className="h-7 rounded-md bg-secondary/60 px-2 text-xs font-medium text-foreground outline-none"
          />
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6 pt-2">
          {billboardDate && (
            <button
              type="button"
              onClick={() => {
                setBillboardDate(undefined);
                setOpen(false);
              }}
              className="mb-3 flex w-full items-center justify-center gap-1.5 h-8 rounded-lg bg-primary/10 text-xs font-medium text-primary active:scale-[0.98]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              返回最新一期
            </button>
          )}

          <div className="grid grid-cols-4 gap-2">
            {saturdays.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                className="flex h-11 flex-col items-center justify-center rounded-xl bg-secondary/40 text-xs font-medium tabular-nums text-foreground active:scale-95 active:bg-primary active:text-primary-foreground"
              >
                <span>
                  {month}月{day}日
                </span>
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
