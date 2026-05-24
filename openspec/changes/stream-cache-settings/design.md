## Context

当前 Workbox Service Worker (`vite.config.ts`) 已配置 `audio-stream-cache`，使用 NetworkFirst 策略 + Range 请求支持。缓存参数硬编码为 `maxEntries: 50`、`maxAgeSeconds: 7天`。用户在浏览器中看不到缓存状态，也无法调整这些参数。

需要新增一个展开式设置项，让用户直观了解缓存使用情况，并能自定义缓存上限和过期时间。

**约束：**
- Workbox `ExpirationPlugin` 的参数在 SW 注册时确定，无法在运行时动态修改
- 因此用户配置的缓存大小/过期时间由**应用层代码**执行清理，而非 Workbox 自动管理
- Workbox 的 ExpirationPlugin 保留最宽松的设置（maxAgeSeconds 设 30 天，maxEntries 设 500），用户配置在应用层执行更严格的限制
- 缓存统计通过 `caches.open('audio-stream-cache')` 从主线程直接查询

## Goals / Non-Goals

**Goals:**
- 在设置页提供一个"边听边缓存"展开项，显示缓存使用统计（条目数、占用空间、配额占比）
- 支持配置最大缓存大小（Select 下拉），默认 1GB
- 支持配置缓存过期时间（Select 下拉），默认 7天
- 提供"清空缓存"按钮
- 主开关控制是否启用流式缓存（关闭时应用层阻止缓存写入）

**Non-Goals:**
- 不修改 Workbox 运行时行为（不写自定义 SW 代码）
- 不实现后台自动清理定时器（仅在用户访问设置页时触发清理检查）
- 不处理 Capacitor 原生端的文件下载缓存
- 不添加国际化支持

## Decisions

### Decision 1: 缓存参数由应用层管理，而非 Workbox 运行时

**选择：** Workbox ExpirationPlugin 保留为 `maxEntries: 500, maxAgeSeconds: 30天`（宽松基础值），用户自定义的限制通过应用层 `cleanupAudioCache()` 函数在进入设置页时触发。

**替代方案：**
- **写自定义 SW 消息处理器**：需要维护自定义 SW 代码，增加复杂度
- **动态修改 SW 注册**：Workbox 不支持运行时修改 ExpirationPlugin 参数

**理由：** 应用层清理对用户透明，实现简单，不需要触及 SW 代码。

### Decision 2: 使用 SettingItem 展开模式而非 Drawer

**选择：** 使用 `SettingItem` 的 `expandedContent` / `isExpanded` props 实现单行展开，类似 `AggregatedSourceSelect` 的模式。

**替代方案：** 使用 Drawer（如 SyncConfig）打开独立面板。

**理由：** 缓存统计信息量适中（几十行），不需要全屏抽屉。展开模式更加轻量，用户无需离开设置页上下文。

### Decision 3: 缓存大小使用 Select 下拉而非 Slider

**选择：** 提供 256MB / 512MB / 1GB / 2GB / 无限制 五档固定选项。

**理由：** Slider 对 256MB-2GB 范围不精确，且用户通常只需要粗粒度控制。Select 下拉与其他设置项风格一致。

### Decision 4: 缓存统计数据存储在 Zustand 中，按需刷新

**选择：** 新增 3 个 store 字段（开关、maxCacheSize、maxAgeDays），缓存统计（条目数、占用空间）通过 React 组件本地 `useState` + `useEffect` 在展开时查询。

**理由：** 统计数据是瞬态的（每次查询时计算），不应持久化。配置字段需要跨会话持久化，放入 Zustand + partialize。

## Risks / Trade-offs

- **[风险] 频繁查询 Cache Storage 可能影响性能** → 仅在展开设置项时查询一次，提供手动刷新按钮
- **[风险] 应用层清理与 Workbox 自动清理可能冲突** → Workbox 设宽松限制，应用层设严格限制，确保永远由应用层先触发
- **[风险] `navigator.storage.estimate()` 在某些浏览器不准确** → 展示估算值并在 UI 标注"约"

## Open Questions

- 关闭缓存开关时，是否应立即清理已有缓存？（当前设计：否，仅阻止新的缓存写入，保留已有缓存供离线使用）
