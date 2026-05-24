## ADDED Requirements

### Requirement: 缓存配置持久化
系统 SHALL 在 music-store 中持久化以下缓存配置字段。

#### Scenario: 字段定义
- **WHEN** 检查 store 的 `MusicState` 接口
- **THEN** 包含 `enableStreamCache: boolean`、`streamCacheMaxSize: number`（单位字节）、`streamCacheMaxAgeDays: number`（单位天）
- **AND** 包含对应的 setter：`setEnableStreamCache`、`setStreamCacheMaxSize`、`setStreamCacheMaxAgeDays`

#### Scenario: 默认值
- **WHEN** store 初始化
- **THEN** `enableStreamCache` 为 `true`、`streamCacheMaxSize` 为 `1073741824`（1GB）、`streamCacheMaxAgeDays` 为 `7`

#### Scenario: 持久化到 IndexedDB
- **WHEN** 用户修改任意缓存配置
- **THEN** 新值通过 Zustand persist 中间件写入 IndexedDB（`oh_music_store`）

#### Scenario: 跨会话恢复
- **WHEN** 用户关闭并重新打开应用
- **THEN** 所有缓存配置字段从 IndexedDB 恢复到用户上次设置的值
