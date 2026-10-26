import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  NETEASE_CATS,
  resolveBarCategories,
  type CatItem,
} from "@/lib/netease/netease-cats";
import { cn } from "@/lib/utils";
import { LayoutGrid, X } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMusicStore } from "@/store/music-store";
import { restrictToParentElement } from "@dnd-kit/modifiers";

const SECTION_TITLE =
  "sticky top-0 z-10 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 bg-background/95 backdrop-blur-sm";

interface PlaylistCategorySelectorProps {
  activeCategory: string;
  onSelect: (id: string) => void;
  trigger?: React.ReactNode;
}

export function PlaylistCategorySelector({
  activeCategory,
  onSelect,
  trigger,
}: PlaylistCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const savedOrder = useMusicStore((s) => s.playlistCategoryOrder);
  const setOrder = useMusicStore((s) => s.setPlaylistCategoryOrder);

  // 解析固定分类与可排序常驻分类
  const { fixed: fixedCats, residents } = resolveBarCategories(savedOrder);
  const residentIds = residents.map((c) => c.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /** 切换常驻状态：修改即落盘 */
  const toggleResident = (catId: string) => {
    const isResident = residentIds.includes(catId);
    const nextOrder = isResident
      ? residentIds.filter((id) => id !== catId)
      : [...residentIds, catId];
    setOrder(nextOrder);
  };

  /** 拖拽结束排序：修改即落盘 */
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = residentIds.indexOf(active.id as string);
    const newIndex = residentIds.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      setOrder(arrayMove(residentIds, oldIndex, newIndex));
    }
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  /** 长按状态：定时器与是否已触发标记 */
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  /** 清除长按定时器 */
  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  /** 按下时启动长按计时，超时触发常驻 toggle */
  const startPress = (catId: string) => {
    clearPress();
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      toggleResident(catId);
    }, 500);
  };

  /** 点击处理：长按后拦截本次 click，避免误选中 */
  const handleGridClick = (id: string) => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    handleSelect(id);
  };

  // 卸载时清理定时器
  useEffect(() => clearPress, []);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-secondary"
          >
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="px-6 py-3 border-b border-border/10">
          <DrawerTitle className="text-base font-semibold tracking-tight">
            歌单分类
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="px-6 pb-8 pt-2 overflow-y-auto">
          <div className="space-y-5">
            {/* 常驻分类区（支持直接拖拽排序与删除） */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className={SECTION_TITLE}>常驻 [可拖拽 / 长按添加]</h4>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* 1. 系统固定分类 */}
                {fixedCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    className={cn(
                      "h-8 px-3 rounded-full text-xs font-medium transition-all flex items-center justify-center border",
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/40 border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}

                {/* 2. 可拖拽、可移除的自定义常驻分类 */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(e) => setDraggingId(e.active.id as string)}
                  onDragCancel={() => setDraggingId(null)}
                  modifiers={[restrictToParentElement]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={residentIds}
                    strategy={rectSortingStrategy}
                  >
                    {residents.map((cat) => (
                      <SortableChip
                        key={cat.id}
                        cat={cat}
                        isActive={activeCategory === cat.id}
                        isDragging={draggingId === cat.id}
                        onSelect={() => handleSelect(cat.id)}
                        onRemove={() => toggleResident(cat.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </section>

            {/* 所有分类目录 */}
            {NETEASE_CATS.map((group) => (
              <section key={group.category} className="space-y-2">
                <h4 className={SECTION_TITLE}>{group.category}</h4>
                <div className="grid grid-cols-4 gap-2">
                  {group.filters.map((f) => {
                    const isPinned = residentIds.includes(f.id);
                    const isSelected = activeCategory === f.id;

                    return (
                      <button
                        key={f.id}
                        onClick={() => handleGridClick(f.id)}
                        onPointerDown={() => startPress(f.id)}
                        onPointerUp={clearPress}
                        onPointerLeave={clearPress}
                        onPointerCancel={clearPress}
                        onContextMenu={(e) => e.preventDefault()}
                        className={cn(
                          "relative h-9 px-2 rounded-xl text-xs font-medium transition-all border flex items-center justify-center select-none",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10"
                            : isPinned
                              ? "bg-primary/10 border-primary/20 text-primary font-semibold"
                              : "bg-secondary/30 border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                        )}
                      >
                        <span className="truncate">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/*                        可排序 Chip 子组件                                  */
/* -------------------------------------------------------------------------- */

interface SortableChipProps {
  cat: CatItem;
  isActive: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableChip({
  cat,
  isActive,
  isDragging,
  onSelect,
  onRemove,
}: SortableChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isItemDragging,
  } = useSortable({ id: cat.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isItemDragging ? transition : undefined,
        zIndex: isItemDragging ? 20 : 1,
      }}
      {...attributes}
      {...listeners}
      className="relative group touch-none select-none"
    >
      <button
        onClick={onSelect}
        className={cn(
          "h-8 pl-3 pr-7 rounded-full text-xs font-medium transition-all border flex items-center justify-center max-w-full",
          isActive
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-secondary/40 border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary",
          isDragging && "scale-105 shadow-lg border-primary/50"
        )}
      >
        <span className="truncate">{cat.name}</span>
      </button>

      {/* 移除按钮：悬停或拖拽微调时展现 */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`移除${cat.name}`}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-muted-foreground/20 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground flex items-center justify-center transition-colors"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
