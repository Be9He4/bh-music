import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Pencil,
  CopyMinus,
  Trash2,
  Image,
  Link,
  type LucideIcon,
  FileOutput,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { TrackSortKey } from "@/lib/utils/sort-tracks";

interface PlaylistOperationsProps {
  onRename?: () => void;
  onDeduplicate: () => void;
  onExport: () => void;
  onDelete?: () => void;
  onSetCover?: () => void;
  onAddByUrl?: () => void;
  onSort?: (key: TrackSortKey) => void;
}

/** 排序字段配置 */
const sortFields: {
  field: string;
  label: string;
  asc: TrackSortKey;
  desc: TrackSortKey;
}[] = [
  { field: "time", label: "添加时间", asc: "time-asc", desc: "time-desc" },
  { field: "name", label: "歌曲名称", asc: "name-asc", desc: "name-desc" },
  {
    field: "artist",
    label: "歌手名称",
    asc: "artist-asc",
    desc: "artist-desc",
  },
];

/**
 * 统一菜单项组件
 * 避免重复写 icon + span + className
 */
function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className={`
        py-2 cursor-pointer
        ${destructive ? "text-red-500 focus:text-red-500 focus:bg-red-50" : ""}
      `}
    >
      <Icon className="h-4 w-4 mr-1" />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

export function PlaylistOperations({
  onRename,
  onDeduplicate,
  onExport,
  onDelete,
  onSetCover,
  onAddByUrl,
  onSort,
}: PlaylistOperationsProps) {
  // 普通操作项（配置驱动）
  const items = [
    onRename && {
      icon: Pencil,
      label: "重命名",
      onClick: onRename,
    },
    onSetCover && {
      icon: Image,
      label: "设置封面",
      onClick: onSetCover,
    },
    onAddByUrl && {
      icon: Link,
      label: "URL 添加",
      onClick: onAddByUrl,
    },
    {
      icon: CopyMinus,
      label: "列表去重",
      onClick: onDeduplicate,
    },
    {
      icon: FileOutput,
      label: "导出歌单",
      onClick: onExport,
    },
  ].filter(Boolean) as {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
  }[];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" title="更多操作">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {items.map((item, index) => (
          <MenuItem key={index} {...item} />
        ))}

        {onSort && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <span>排序方式</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {sortFields.map(({ label, asc, desc }) => (
                  <div key={label}>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {label}
                    </div>
                    <DropdownMenuItem onClick={() => onSort(asc)}>
                      <ArrowUp className="h-4 w-4 mr-2" />
                      正序
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSort(desc)}>
                      <ArrowDown className="h-4 w-4 mr-2" />
                      倒序
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <MenuItem
              icon={Trash2}
              label="删除歌单"
              onClick={onDelete}
              destructive
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
