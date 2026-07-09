# AI-Girlfriend App 打包说明

> 使用 **Capacitor** 将 Web 前端打包为 Android APK

---

## 项目已完成的配置

以下配置已经做好，无需重复操作：

- ✅ `@capacitor/core`、`@capacitor/cli`、`@capacitor/android` 已安装
- ✅ `capacitor.config.ts` 已创建（App 名、包名、构建目录）
- ✅ `vite.config.ts` 已添加 `base: './'`（移动端相对路径加载）
- ✅ `android/` 原生工程已生成
- ✅ 首次构建产物 `dist/` 已同步到 android 工程

---

## 第一步：安装 Android Studio

### 1.1 下载安装
去官网下载 Android Studio（国内镜像）：https://developer.android.google.cn/studio?hl=zh-cn

Windows 直接下载 `.exe` 安装包。

### 1.2 安装路径选择（装到非 C 盘）

安装过程有 **两处** 可以改路径：

| 步骤 | 安装的是什么 | 建议路径 | 说明 |
|---|---|---|---|
| **选择安装目录** | Android Studio 软件本身 | `D:\Android\Android Studio` | 安装向导第一步，点 Browse 改 |
| **选择 SDK 目录** | Android SDK（核心，占用大） | `D:\Android\Sdk` | 安装向导勾选 SDK 时会显示路径，点右侧文件夹图标改 |

> ⚠️ SDK 占用约 **5~15 GB**，强烈建议不要放 C 盘！

### 1.3 安装 Android SDK（首次打开时自动提示）
- 打开 Android Studio
- 首次启动会提示下载 SDK，选择 **API 34 或更高版本**（默认勾选即可）
- 等待下载完成

### 1.4 配置环境变量

安装完成后，按实际 SDK 路径配置环境变量（**右键"此电脑" → 属性 → 高级系统设置 → 环境变量**）：

**新增系统变量：**
```
变量名: ANDROID_HOME
变量值: D:\Android\Sdk          ← 改成你刚才选的 SDK 路径
```

**编辑系统变量 Path，新增两条：**
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

**验证是否成功：**
```powershell
# 新开一个 PowerShell，输入
adb --version
# 有输出版本号就说明配好了
```

---

## 第二步：确保后端可访问

> ⚠️ 重要：App 运行在真机上，无法访问 `http://localhost:8000`！

### 方案 A：部署后端到服务器（推荐）

修改 `vite.config.ts` 第 21 行的 `API_BASE_URL`：

```ts
// 改成你后端服务器的实际地址
const API_BASE = 'https://你的服务器IP或域名'
```

或通过环境变量指定（打包时生效）：
```powershell
# PowerShell
$env:API_BASE_URL="https://你的后端地址"; npm run build
```

### 方案 B：开发调试（手机和电脑同一 WiFi）

修改 `capacitor.config.ts`，取消注释 `server` 配置：

```ts
const config: CapacitorConfig = {
  appId: 'com.aigirlfriend.app',
  appName: 'AI-Girlfriend',
  webDir: 'dist',
  server: {
    url: 'http://192.168.x.x:5173',  // 改成你电脑的局域网 IP
    cleartext: true,
  },
};
```

然后用 `npm run dev` 启动开发服务器，手机上 App 会直接访问你电脑的 dev server，支持热更新调试。

---

## 第三步：构建 APK

### 3.1 构建前端
```powershell
cd client
npm run build
```

### 3.2 同步到 Android 工程
```powershell
npx cap sync
```

### 3.3 打开 Android Studio
```powershell
npx cap open android
```

### 3.4 在 Android Studio 中打包
1. 等待项目加载完毕（Gradle sync 完成）
2. 顶部菜单：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. 等待构建完成，右下角弹出通知
4. 点击 `locate` 找到 `.apk` 文件

APK 路径通常在：
```
client\android\app\build\outputs\apk\debug\app-debug.apk
```

### 3.5 安装到手机
把 `.apk` 文件传到手机，直接点击安装即可。

> 首次安装需要在手机 **设置 → 安全 → 允许安装未知来源应用**

---

## 日常开发工作流

每次改完代码重新打包：

```powershell
# 1. 构建前端
cd client
npm run build

# 2. 同步到 Android 工程
npx cap sync

# 3. 打开 Android Studio 重新打包
npx cap open android
# 然后在 Android Studio 里 Build → Build APK(s)
```

---

## 生成正式签名的 APK（发布用）

上面的方法生成的是 **debug 版本**，仅用于测试。如果要发应用商店：

### 4.1 生成签名密钥（只需一次）
```powershell
keytool -genkey -v -keystore aigirlfriend.keystore -alias aigirlfriend -keyalg RSA -keysize 2048 -validity 10000
```
按提示设置密码等信息，记住你填的密码。

### 4.2 在 Android Studio 中配置签名
1. 打开 `Build` → `Generate Signed Bundle / APK`
2. 选择 `APK`
3. 选择刚才生成的 `.keystore` 文件，填写密码和别名
4. 选择 `release` 构建类型
5. 点击 `Finish` 生成正式版 APK

---

## 附：文件结构

```
client/
├── capacitor.config.ts      # Capacitor 配置（App 名、包名、构建目录）
├── vite.config.ts           # Vite 构建配置（base: './' 已配置）
├── dist/                    # 前端构建产物
├── android/                 # Android 原生工程 ← 打包 APK 从这里出
├── src/                     # React 源代码
└── APP打包说明.md            # 本文档
```

## 附：iOS 打包（仅 macOS）

如果你有 Mac，可以添加 iOS 平台：

```bash
# 安装 iOS 平台包
cd client
npm install @capacitor/ios --save

# 添加 iOS 平台
npx cap add ios

# 打开 Xcode 打包
npx cap open ios
```
