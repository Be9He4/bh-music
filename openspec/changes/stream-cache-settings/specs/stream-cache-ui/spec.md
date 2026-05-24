## ADDED Requirements

### Requirement: 缓存开关
系统 SHALL 在"偏好设置"区域提供一个"边听边缓存"设置项，包含开关控制。

#### Scenario: 默认开启
- **WHEN** 用户首次打开设置页面
- **THEN** "边听边缓存"开关显示为开启状态

#### Scenario: 切换关闭
- **WHEN** 用户将开关切换至关闭
- **THEN** 系统停止新的音频缓存写入，但不删除已有缓存

#### Scenario: 点击标题展开
- **WHEN** 用户点击"边听边缓存"标题区域（非开关）
- **THEN** 展开缓存统计信息和配置项

#### Scenario: 展开时加载缓存统计
- **WHEN** 用户展开"边听边缓存"设置项
- **THEN** 系统查询 `audio-stream-cache` 并显示：缓存条目数、已用空间（格式化如 "128.5 MB"）、存储配额占比百分比

### Requirement: 缓存统计展示
展开区域 SHALL 显示实时缓存使用情况的统计卡片。

#### Scenario: 有缓存数据
- **WHEN** 缓存中有已缓存的音频条目
- **THEN** 显示"已缓存 X 首歌曲"和"占用空间 X MB / 配额 X GB (Y%)"

#### Scenario: 缓存为空
- **WHEN** 缓存中无任何条目
- **THEN** 显示"暂无缓存数据"

#### Scenario: 手动刷新
- **WHEN** 用户点击统计区域的刷新按钮
- **THEN** 重新查询缓存统计并更新显示

### Requirement: 最大缓存大小配置
系统 SHALL 提供 Select 下拉选择最大缓存大小。

#### Scenario: 默认值
- **WHEN** 用户首次查看设置
- **THEN** 最大缓存大小显示为 "1 GB"

#### Scenario: 选项列表
- **WHEN** 用户点击最大缓存大小下拉框
- **THEN** 显示选项：256 MB、512 MB、1 GB、2 GB、无限制

#### Scenario: 选择后持久化
- **WHEN** 用户选择 "512 MB"
- **THEN** 该选择被保存到 IndexedDB，下次打开应用时保留

### Requirement: 缓存过期时间配置
系统 SHALL 提供 Select 下拉选择缓存过期时间。

#### Scenario: 默认值
- **WHEN** 用户首次查看设置
- **THEN** 过期时间显示为 "7 天"

#### Scenario: 选项列表
- **WHEN** 用户点击过期时间下拉框
- **THEN** 显示选项：1 天、3 天、7 天、14 天、30 天

#### Scenario: 更改过期时间触发清理
- **WHEN** 用户将过期时间从 7 天改为 3 天
- **THEN** 系统触发缓存清理，删除超过 3 天的缓存条目

### Requirement: 清空缓存
系统 SHALL 提供"清空缓存"按钮。

#### Scenario: 确认清空
- **WHEN** 用户点击"清空缓存"按钮并确认
- **THEN** 系统删除 `audio-stream-cache` 中所有条目，并刷新统计显示

#### Scenario: 清空后状态
- **WHEN** 缓存被清空后
- **THEN** 统计显示归零，"清空缓存"按钮变为禁用状态
