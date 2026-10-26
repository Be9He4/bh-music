import { useNavigate } from "react-router-dom";
import { AWARDS } from "@/lib/awards/awards-meta";

/** 精选下的"奖项"子 Tab：金曲奖 / 格莱美两张入口卡片，普通歌单网格样式，默认最新一届。 */
export function AwardsSection() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
      {AWARDS.map((meta) => (
        <div
          key={meta.id}
          className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px] cursor-pointer"
          onClick={() => navigate(`/awards/${meta.id}`)}
        >
          <div
            className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow"
            style={{
              backgroundImage: `linear-gradient(135deg, ${meta.colors[0]}, ${meta.colors[1]})`,
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <p className="text-white font-black tracking-tight leading-none text-lg">
                {meta.name}
              </p>
              <p className="mt-1.5 text-[8px] font-black tracking-[0.25em] uppercase text-white/50 line-clamp-1">
                {meta.enName}
              </p>
            </div>
          </div>
          <div className="px-0.5">
            <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors">
              {meta.name}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
