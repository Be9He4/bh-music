# BH Music

<div align="center">
  <img src="public/favicon.png" width="128" height="128" alt="Logo" />
</div>

<p align="center">
  <b>BH Music</b> 是一款基于 React 和 Capacitor 构建的现代跨平台音乐播放器。<br>
  （基于 Otter Music 深度定制化构建）
</p>

## ✨ 特性

- 🎵 **跨平台**：支持 Android、Web（PWA）。
- 🎨 **现代化 UI**：全新设计的播放界面与精美的 UI 交互体验。
- ⚡ **轻量级**：核心无臃肿，播放流畅。
- 🔌 **插件化架构**：支持自定义数据源插件。
- ☁️ **云端同步**：支持 WebDAV 多端同步播放列表与设置。

## 📦 部署与构建

### Web 端 (Cloudflare Pages)

本项目可以直接部署在 Cloudflare Pages：
1. 链接你的 GitHub 仓库。
2. 构建命令：`npm run build`
3. 构建输出目录：`dist`

### Android 端

如果需要自行构建 Android 安装包 (APK)，请确保你已经安装了以下环境：
- [Node.js](https://nodejs.org/) (建议 v20+)
- [Android Studio](https://developer.android.com/studio) 及相关的 Android SDK
- Java JDK 17

#### 构建步骤：

```bash
# 1. 安装依赖
npm install

# 2. 构建前端静态资源
npm run build

# 3. 同步资源到 Android 工程
npx cap sync android

# 4. 在 Android Studio 中打开并运行，或者直接执行打包命令
npx cap open android
```

## 📜 许可

本项目基于原作者项目深度定制，保留原开源协议。
