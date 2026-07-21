# AI-Girlfriend iOS 打包说明

> 使用 **Capacitor 8** 将 React Web 前端打包为 iOS App（IPA）

---

## 前置条件

| 条件 | 说明 |
|---|---|
| **macOS** | 必须，iOS 开发只能在 Mac 上进行 |
| **Xcode** | 从 Mac App Store 安装（约 12GB） |
| **Node.js** | 已安装（项目需要的版本） |
| **Apple ID** | 免费账号即可真机调试；发布 App Store 需要 $99/年开发者账号 |

---

## 项目已完成的配置

以下配置已经做好，无需重复操作：

- ✅ `@capacitor/core`、`@capacitor/cli`、`@capacitor/ios`、`@capacitor/inappbrowser` 已安装
- ✅ `capacitor.config.ts` 已创建（App 名、包名、构建目录）
- ✅ `vite.config.ts` 已添加 `base: './'`（移动端必须使用相对路径加载资源）
- ✅ `.env.production` 已配置 `VITE_API_BASE_URL=https://www.trandsai.com`（打包后 API 指向生产服务器）
- ✅ `ios/` 原生工程已生成
- ✅ 构建产物 `dist/` 已同步到 iOS 工程

### 当前关键配置速查

```
App 名称：      AI-Girlfriend
Bundle ID：    com.aigirlfriend.app
构建目录：      dist/
iOS 工程路径：   ios/App/
WebView 插件：  @capacitor/inappbrowser (用于隐私协议等内嵌网页)
```

---

## 第零步：已执行的配置过程（了解即可，无需重做）

> 这一节记录了配置 iOS 平台时实际执行的命令和原因，帮助你理解项目是怎么搭起来的。
> 如果你以后在新电脑上重建项目，按这一节操作即可复现。

### 0.1 capacitor.config.ts — Capacitor 核心配置

```ts
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aigirlfriend.app',   // App 的唯一标识（反向域名格式）
  appName: 'AI-Girlfriend',         // 手机桌面上显示的名称
  webDir: 'dist',                   // 前端构建产物的目录
  server: {
    // 本地调试时打开下面两行，让 App 直连 dev server
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
  },
};

export default config;
```

**解释：**

| 字段 | 作用 | iOS 对应 |
|---|---|---|
| `appId` | 反向域名格式的唯一 ID | Xcode 中的 Bundle Identifier，必须与 App Store Connect 中一致 |
| `appName` | App 名称 | 手机桌面显示的名字，也是 Xcode 中的 Display Name |
| `webDir` | Web 资源目录 | `cap sync` 时会把 `dist/` 内容复制到 `ios/App/App/public/` |
| `server.url` | 开发时直连 dev server | 支持热更新调试，打包时注释掉即使用本地 `dist/` |

### 0.2 vite.config.ts — 构建配置

```ts
// vite.config.ts 关键行
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_BASE = env.API_BASE_URL || 'http://localhost:8000'

  return {
    base: './',   // ← 这一行是关键！移动端必须用相对路径
    // ...
  }
})
```

**为什么 `base: './'` 很重要？**

Web 应用默认的 `<script src="/assets/xxx.js">` 在普通浏览器没问题，但 Capacitor 是把 `dist/` 文件打包进 App 本地文件系统，用绝对路径 `/` 找不到文件，必须用相对路径 `./assets/xxx.js`。

**没有这行会怎样？** App 打开白屏，因为所有 JS/CSS 资源都 404。

### 0.3 .env.production — 生产环境后端地址

```bash
# .env.production
VITE_API_BASE_URL=https://www.trandsai.com
```

**为什么需要这个？**

开发时 `npm run dev`，Vite 自带代理可以把 `/api` 请求转发到 `localhost:8000`。

但打包成 App 后没有 Vite 代理了，所有 API 请求需要完整地址。`.env.production` 在 `npm run build` 时自动加载，告诉代码后端在 `https://www.trandsai.com`。

**代码中怎么用的？** 项目中的 API 请求函数会读取这个变量拼接 URL：

```ts
// 示例逻辑（实际代码在 src 中）
const BASE = import.meta.env.VITE_API_BASE_URL || ''
fetch(`${BASE}/api/xxx`)
```

### 0.4 安装 @capacitor/ios — iOS 平台支持包

```bash
cd /Users/ww/project/aiGrilfriend/client
npm install @capacitor/ios
```

**做了什么：**
- 在 `node_modules/` 中安装 Capacitor iOS 工具库
- 在 `package.json` 的 `dependencies` 中添加 `@capacitor/ios`

**为什么需要它：**
- `npx cap add ios` 命令依赖这个包才能生成 iOS 原生工程
- `npx cap sync ios` 依赖它把 web 资源和插件同步到 Xcode 工程

### 0.5 添加 iOS 平台 — 生成原生 Xcode 工程

```bash
npx cap add ios
```

**输出示例：**
```
✔ Adding native Xcode project in ios in 9.29ms
✔ add in 9.58ms
✔ Copying web assets from dist to ios/App/App/public in 6.16ms
✔ Creating capacitor.config.json in ios/App/App in 232.79μs
✔ copy ios in 27.58ms
✔ Updating iOS plugins in 3.92ms
[info] Found 1 Capacitor plugin for ios:
       @capacitor/inappbrowser@4.0.1
✔ update ios in 21.41ms
[success] ios platform added!
```

**做了什么：**
1. 在 `ios/` 目录下生成了一个完整的 Xcode 项目，包含：
   - `ios/App/App.xcworkspace` — Xcode 工作空间文件（用这个打开，不是 `.xcodeproj`）
   - `ios/App/App/AppDelegate.swift` — App 入口，初始化 Capacitor WebView
   - `ios/App/App/Info.plist` — App 配置（权限、版本号等）
   - `ios/App/App/public/` — Web 资源的存放位置
   - `ios/App/Package.swift` — Swift 包管理文件
2. 把 `dist/` 中的前端文件复制到 `ios/App/App/public/`
3. 把 `capacitor.config.ts` 转为 JSON 放进 iOS 工程
4. 自动发现并配置已安装的 Capacitor 插件（这里是 `@capacitor/inappbrowser`）

### 0.6 构建前端 — 生成 dist/

```bash
npm run build
```

**做了什么：**

执行 `vite build`，Vite 会：

1. **读取 `.env.production`**：加载 `VITE_API_BASE_URL=https://www.trandsai.com` 注入到代码中
2. **编译 TypeScript/JSX**：把 `.tsx`、`.ts` 编译为浏览器可执行的 `.js`
3. **CSS 处理**：Tailwind CSS 按需生成样式
4. **代码分包**：按 `vite.config.ts` 的 `manualChunks` 配置拆分 vendor 包
5. **输出到 `dist/`**：生成 `index.html` + 所有 JS/CSS 资源文件

```bash
# 构建产物示例：
dist/
├── index.html
├── assets/
│   ├── index-xxx.js       # 主入口
│   ├── vendor-react-xxx.js  # React 相关库
│   ├── vendor-mui-xxx.js    # MUI 组件库
│   ├── Chat-xxx.js          # 聊天页面
│   ├── Profile-xxx.js       # 个人页面
│   └── ...
```

### 0.7 同步到 iOS 工程 — 刷新原生项目

```bash
npx cap sync ios
```

**输出示例：**
```
✔ Copying web assets from dist to ios/App/App/public in 5.28ms
✔ Creating capacitor.config.json in ios/App/App in 229.42μs
✔ copy ios in 25.50ms
✔ Updating iOS plugins in 3.61ms
[info] All Capacitor plugins have a Package.swift file
[info] Writing Package.swift
[info] Found 1 Capacitor plugin for ios:
       @capacitor/inappbrowser@4.0.1
✔ update ios in 23.12ms
[info] Sync finished in 0.065s
```

**做了什么：**

| 步骤 | 说明 |
|---|---|
| 复制 Web 资源 | `dist/` → `ios/App/App/public/`（App 运行时从这里加载页面） |
| 更新配置 | 把最新的 `capacitor.config.ts` 转成 JSON 放进 iOS 工程 |
| 更新插件 | 把 `@capacitor/inappbrowser` 等插件的原生代码链接到 Xcode 工程 |
| 写 Package.swift | 确保 Swift 包管理器能正确引用所有插件 |

**`cap sync` vs `cap copy` 的区别：**

| 命令 | 复制 Web 资源 | 更新插件原生代码 |
|---|---|---|
| `npx cap copy` | ✅ | ❌ |
| `npx cap sync` | ✅ | ✅ |

> 日常改前端代码后，`cap copy` 就够了；安装/更新插件后必须 `cap sync`。

### 0.8 安装 @capacitor/inappbrowser — 内嵌 WebView 插件

```bash
npm install @capacitor/inappbrowser@latest
```

**为什么需要它？**

App 中有隐私协议页面，需要加载外部网页 `https://www.markwallpapers.com/privacy/...`。直接用 `iframe` 嵌入会被对方服务器通过 `X-Frame-Options: SAMEORIGIN` 头拦截，显示空白。

`@capacitor/inappbrowser` 用原生 `WKWebView`（iOS）/ `WebView`（Android）打开网页，不受跨域限制，自带工具栏和返回/关闭按钮。

**iOS 端不需要额外配置**，插件会自动通过 Swift Package Manager 集成到 Xcode 工程。

### 配置之间的关系总结

```
开发时的数据流：
  写代码 (src/*.tsx)
    → npm run build
      → 读 .env.production（获取 API 地址）
      → Vite 编译 + 打包
        → 输出 dist/
          → npx cap sync ios
            → 复制 dist/ 到 ios/App/App/public/
            → 更新插件原生代码
              → npx cap open ios
                → Xcode 编译原生 + WebView 加载 public/ 中的前端
                  → 手机上的 App！
```

---

## 第一步：安装 Xcode（必须）

### 1.1 下载安装

从 Mac App Store 下载 Xcode：

```
https://apps.apple.com/app/xcode/id497799835
```

> ⚠️ Xcode 约 **12GB**，请预留足够磁盘空间。安装可能需要 30 分钟到 1 小时。

### 1.2 首次启动配置

安装完成后，打开 Xcode：

1. 同意许可协议
2. 等待 "Installing components…" 完成（首次启动自动安装模拟器、工具链等）
3. 确认安装成功：

```bash
xcodebuild -version
# 应输出版本号，例如：
# Xcode 17.0
# Build version 17A328
```

> ⚠️ 仅安装 Command Line Tools 是不够的，必须安装完整的 Xcode（含 iOS SDK 和模拟器）。

### 1.3 确认命令行工具路径指向 Xcode

```bash
# 查看当前路径
xcode-select -p

# 如果显示 /Library/Developer/CommandLineTools（只有命令行工具），需要切换到 Xcode：
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# 再次确认
xcode-select -p
# 应输出：/Applications/Xcode.app/Contents/Developer
```

---

## 第二步：配置后端地址

> ⚠️ 重要：App 运行在真机/模拟器上，无法访问 `http://localhost:8000`！

项目通过 `.env.production` 管理后端的生产地址：

### 环境变量说明

| 文件 | 何时生效 | 当前配置 |
|---|---|---|
| `.env.development` | `npm run dev`（开发） | `VITE_API_BASE_URL=` （空，走 Vite 代理 → localhost:8000） |
| `.env.production` | `npm run build`（打包） | `VITE_API_BASE_URL=https://www.trandsai.com` |

### 场景 1：打包连接生产后端（当前配置）

**已经配好，直接构建即可：**

```bash
npm run build          # 自动加载 .env.production
npx cap sync ios
npx cap open ios       # 进 Xcode → 运行
```

### 场景 2：本地调试 + 连接本地后端（同一 WiFi 下）

修改 `capacitor.config.ts`，让 App 直连你电脑的 dev server：

```ts
const config: CapacitorConfig = {
  appId: 'com.aigirlfriend.app',
  appName: 'AI-Girlfriend',
  webDir: 'dist',
  server: {
    url: 'http://192.168.x.x:5173',  // 改成你 Mac 的局域网 IP
    cleartext: true,                  // 允许 HTTP 明文连接
  },
};
```

然后：

```bash
# 终端 1：启动后端
# 终端 2：启动前端 dev server
npm run dev
# 终端 3：Xcode 中直接 ▶ Run
```

> 这种方式支持热更新（HMR），改代码后会自动刷新 App。

### 场景 3：iOS 模拟器连接本地后端

模拟器可以直接访问 Mac 的 `localhost`，不需要改 capacitor.config.ts：

在 `.env.development` 中保持 `VITE_API_BASE_URL=http://localhost:8000`，直接用 `npm run dev` 启动，然后在 Xcode 中选择模拟器 ▶ Run。

---

## 第三步：构建与同步

### 3.1 构建前端

每次修改代码后重新打包：

```bash
cd /Users/ww/project/aiGrilfriend/client

# 构建前端（自动加载 .env.production）
npm run build
```

构建产物在 `dist/` 目录中。

### 3.2 同步到 iOS 工程

```bash
# 将 dist/ 中的前端资源复制到 iOS 工程
npx cap sync ios
```

### 3.3 打开 Xcode

```bash
# 在 Xcode 中打开 iOS 工程
npx cap open ios
```

> 注意：打开的是 `ios/App/App.xcworkspace`（工作空间文件），不是 `.xcodeproj`！

---

## 第四步：Xcode 配置

打开 Xcode 后，左侧项目导航栏会看到：

```
App (蓝色图标，项目根)
  ├── App
  │   ├── AppDelegate.swift
  │   ├── Main.storyboard
  │   └── ...
  └── Pods (或 Package Dependencies)
```

### 4.1 iOS 签名体系 — 证书是什么？为什么需要？

iOS 的安全机制要求每个 App 必须经过**代码签名**才能在真机上运行。这和 Android 的 APK 签名是同一个道理，但 iOS 的签名体系更复杂。

#### 签名链条（三个核心概念）

```
开发者证书 (Certificate)
      ↓ 证明"你是谁"
App ID (Bundle Identifier)
      ↓ 标识"哪个 App"
描述文件 (Provisioning Profile)
      ↓ 把上面两个绑在一起 + 授权设备列表
签名后的 App
      ↓ iPhone 验证：证书有效 + App ID 匹配 + 设备在允许列表中
可以安装到手机
```

| 概念 | 通俗理解 | 存放位置 | 有效期 |
|---|---|---|---|
| **开发者证书** (Certificate) | 你的"数字身份证"，证明你是合法开发者 | Mac 钥匙串 (Keychain) | 1 年（付费）/ 7 天（免费） |
| **App ID** (Bundle ID) | App 的唯一身份证号，如 `com.aigirlfriend.app` | Apple 开发者中心 | 永久 |
| **描述文件** (Provisioning Profile) | "许可证"，写着：证书 X + App Y 可以装到设备 A、B、C 上 | Xcode 自动管理，存在 `~/Library/MobileDevice/Provisioning Profiles/` | 1 年（付费）/ 7 天（免费） |

#### 两种签名方式

##### 方式一：自动管理签名（推荐新手）

Xcode 帮你搞定证书、App ID、描述文件的创建和更新，你只需要登录 Apple ID。

**操作步骤：**

1. 点击左侧项目导航栏最顶部的蓝色 **App** 项目图标
2. 在中间区域选择 **App** target（注意不是 Project）
3. 点击 **Signing & Capabilities** 标签
4. 勾选 ✅ **Automatically manage signing**
5. 在 **Team** 下拉菜单中选择你的 Apple ID

**背后发生的事（Xcode 自动处理）：**

```
你点下 Team 选择 Apple ID
  → Xcode 检查钥匙串里有没有你的开发者证书
    → 没有：自动向 Apple 申请一个开发证书，下载到钥匙串
  → Xcode 在 Apple 开发者中心注册 App ID (com.aigirlfriend.app)
    → 如果已被别人占用，会报错，需要换一个 Bundle ID
  → Xcode 生成描述文件，包含：
    - 你的开发证书
    - App ID
    - 授权设备列表（真机调试时自动把你连的 iPhone UDID 加进去）
  → 描述文件下载到 Mac
  → 签名完成，可以 ▶ Run
```

##### 方式二：手动管理签名（需要更深理解）

如果自动签名出问题，切到手动模式：

1. 取消勾选 **Automatically manage signing**
2. **Provisioning Profile** 下拉手动选择对应的描述文件
3. **Signing Certificate** 选择对应的证书

一般用不到，知道就行。

#### Apple ID 账号类型与证书的区别

| 账号类型 | 费用 | 证书类型 | 有效期 | 能做什么 |
|---|---|---|---|---|
| **免费 Apple ID** | 免费 | Personal Team 开发证书 | **7 天** | 模拟器调试 + 真机调试（到期需重签） |
| **Apple Developer Program** | **$99/年** | 开发证书 + 发布证书 | **1 年** | 真机调试 + 发布 App Store + TestFlight |

**免费账号的限制：**
- 真机 App 7 天后过期，届时手机上的 App 会闪退，需要重新连 Mac ▶ Run
- 最多注册 **10 个** App ID
- 不能使用 TestFlight
- 不能发布到 App Store
- 不能使用某些 Capabilities（如推送通知、HealthKit、Siri 等）

**付费账号（$99/年）：**
- 证书 1 年有效
- App 安装后不会过期（除非证书到期或描述文件到期）
- 可以使用 TestFlight 分发给 10,000 名测试者
- 可以发布到 App Store
- 可以使用所有 Capabilities

> 建议：先用免费账号跑通流程，确定要发布时再付费开通。

#### 如何查看证书和描述文件

**查看本机证书：**
```bash
# 打开钥匙串访问，筛选"登录"→"我的证书"
open /System/Library/CoreServices/Applications/Keychain\ Access.app

# 或用命令行查看
security find-identity -v -p codesigning
# 输出示例：
# 1) ABC123... "Apple Development: your@email.com (XXXXX)"
# 2) DEF456... "Apple Distribution: Your Name (YYYYY)"    ← 付费才有
```

**查看描述文件：**
```bash
ls ~/Library/MobileDevice/Provisioning\ Profiles/
# 一堆 .mobileprovision 文件，文件名是 UUID
```

**查看某个描述文件的内容：**
```bash
security cms -D -i ~/Library/MobileDevice/Provisioning\ Profiles/xxxxx.mobileprovision
```

#### 免费账号真机调试 — 证书过期了怎么办？

7 天后 App 闪退，操作步骤：

1. iPhone 连 Mac
2. Xcode 中再次按 `⌘R` 运行
3. Xcode 会自动续签证书和描述文件
4. 新签名的 App 覆盖安装到手机

> 这就是免费账号的日常：每 7 天重新 ▶ Run 一次。

#### 真机首次安装 — 信任证书

签名通过的 App 装到 iPhone 上后，iOS 还会弹一个"不信任的开发者"提示：

**解决：** iPhone 上进入 **设置 → 通用 → VPN 与设备管理** → 在"开发者 App"下点击你的 Apple ID → **信任**

> 这一步只有第一次安装时需要，之后覆盖安装不需要。

### 4.2 修改 Bundle Identifier（可选）

如果 `com.aigirlfriend.app` 已经被占用，修改为自己的：

在 **Signing & Capabilities** 中修改 **Bundle Identifier**，例如：
```
com.yourname.aigirlfriend
```

> ⚠️ 修改后需要同步更新 `capacitor.config.ts` 中的 `appId`，否则下次 `cap sync` 会覆盖。

### 4.3 选择目标设备

Xcode 顶部工具栏，点击设备选择器：

- **模拟器测试**：选择一个 iPhone 型号，如 `iPhone 16 Pro`
- **真机测试**：用数据线连接 iPhone，手机会出现在列表中

> 首次连接真机：iPhone 上会弹出「要信任此电脑吗？」→ 点击 **信任**

### 4.4 部署目标版本

点击项目 → **App** target → **General** 标签，确认 **Minimum Deployments**：

```
建议设置为 iOS 15.0 或更高
```

---

## 第五步：运行与调试

### 5.1 模拟器运行

1. Xcode 顶部选择模拟器（如 iPhone 16 Pro）
2. 点击 **▶ Run** 按钮（或按 `⌘R`）
3. 模拟器会自动启动，App 安装后自动打开

### 5.2 真机运行

1. 用数据线连接 iPhone 到 Mac
2. Xcode 顶部选择你的 iPhone
3. 点击 **▶ Run**（`⌘R`）
4. 首次运行：iPhone 上进入 **设置 → 通用 → VPN 与设备管理** → 信任开发者证书
5. App 会自动安装在 iPhone 上

### 5.3 查看控制台日志

Xcode 底部的调试区域会实时显示 App 的日志输出（包括 `console.log`）：

```
右下角按钮 → 打开 Debug Area（⇧⌘Y）
```

### 5.4 Safari 远程调试

对于 WebView 内容，可以用 Safari 调试：

1. iPhone：**设置 → Safari → 高级 → 打开 Web 检查器**
2. Mac：Safari → **开发** 菜单 → 选择你的设备 → 选择 AI-Girlfriend App
3. 打开 Web Inspector，可以查看 DOM、Network、Console 等

> 如果 Safari 没有「开发」菜单：Safari → 设置 → 高级 → 勾选「在菜单栏显示开发菜单」

---

## 第六步：打包 IPA

### 6.1 Debug 版本（仅用于测试）

Debug 版可以直接 ▶ Run 到手机，也可以导出 IPA：

在 Xcode 中：
1. 选择 **Any iOS Device** 作为目标
2. 菜单：**Product** → **Archive**
3. 构建完成后自动打开 **Organizer** 窗口
4. 选中刚生成的 Archive → 点击 **Distribute App**
5. 选择 **Custom** → 选择你的 Team
6. 导出方式选择 **Development**
7. 选择保存位置，导出 `.ipa` 文件

### 6.2 Release 版本（发布到 App Store）

#### 6.2.1 在 App Store Connect 创建 App

1. 打开 [App Store Connect](https://appstoreconnect.apple.com)
2. 点击 **我的 App** → **+** → **新建 App**
3. 填写信息：
   - 平台：iOS
   - 名称：AI-Girlfriend
   - 主要语言：Simplified Chinese（或你需要的语言）
   - Bundle ID：com.aigirlfriend.app（需与 Xcode 中一致）
   - SKU：任意唯一字符串，如 `aigirlfriend_2024`
4. 点击 **创建**

#### 6.2.2 在 Xcode 中 Archive 并上传

1. Xcode 顶部选择 **Any iOS Device**（不是模拟器）
2. 菜单：**Product** → **Archive**
3. Organizer 中选中 Archive → **Distribute App**
4. 选择 **App Store Connect** → **Upload**
5. 一路 Next，等待上传完成

#### 6.2.3 App Store Connect 后续操作

上传成功后，在 App Store Connect 中：

1. 填写 App 描述、截图、隐私政策网址等
2. 设置年龄分级
3. 在 **构建版本** 中选择刚上传的版本
4. 点击 **提交审核**

> ⚠️ App Store 审核通常需要 1-3 天，首次审核可能更慢（审核指南较严格）。

### 6.3 TestFlight 内测分发

TestFlight 可以将 App 分发给最多 10,000 名测试人员，无需审核：

1. 将 Archive 上传到 App Store Connect（同 6.2.2 步骤）
2. App Store Connect → **TestFlight** → 选择构建版本
3. 添加测试人员（通过邮箱邀请）
4. 测试人员在 iPhone 上安装 TestFlight App 即可下载测试

---

## 第七步：常见问题排查

### 问题 1：Xcode 提示 "Signing requires a development team"

**解决**：在 Signing & Capabilities → Team 中选择你的 Apple ID。如果没有，先去 Xcode Settings → Accounts 中添加。

### 问题 2：真机运行提示 "Untrusted Developer"

**解决**：iPhone 上进入 **设置 → 通用 → VPN 与设备管理**，在「开发者 App」下找到你的证书，点击 **信任**。

### 问题 3：App 打开后白屏

**可能原因与解决**：
1. `vite.config.ts` 中 `base: './'` 未设置 → 确认已设置
2. 浏览器路由模式问题 → Capacitor 使用 hash 路由或确保 `capacitor.config.ts` 中 `server.allowNavigation` 配置正确
3. 前端资源未同步 → 重新执行 `npm run build && npx cap sync ios`

### 问题 4：API 请求失败 / 网络错误

**检查**：

- `.env.production` 中 `VITE_API_BASE_URL` 是否正确
- 后端服务器是否允许 iOS App 的请求（CORS、HTTPS 证书等）
- **iOS 强制使用 HTTPS**：如果后端是 HTTP，需要在 `Info.plist` 中配置 App Transport Security 例外，或给后端加上 HTTPS

#### 配置 ATS 例外（允许 HTTP 请求）

在 Xcode 中，打开 `ios/App/App/Info.plist`，添加：

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

> ⚠️ 这只是开发调试用，提交 App Store 时可能被拒，生产环境务必使用 HTTPS。

### 问题 5：模拟器 vs 真机行为不一致

大部分差异来自：
- **网络**：模拟器使用 Mac 网络；真机使用移动网络/WiFi
- **权限**：相机、相册、通知等权限在真机上需要用户授权
- **性能**：真机性能可能比模拟器差，注意测试低端机型

### 问题 6：Capacitor 插件不工作

```bash
# 重新同步插件
npx cap sync ios

# 如果还有问题，清理后重试
cd ios/App
xcodebuild clean
cd ../..
npx cap sync ios
```

### 问题 7：Archive 失败或 IPA 无法安装

常见原因：
- **签名证书问题**：检查 Keychain Access 中的证书是否有效
- **Provisioning Profile 过期**：在 Xcode → Settings → Accounts → Manage Certificates 中重新生成
- **Capabilities 不匹配**：App ID 的 Capabilities 需与 Xcode 中配置一致

---

## 日常开发工作流

每次改完代码重新打包到 iOS：

```bash
# 1. 进入项目目录
cd /Users/ww/project/aiGrilfriend/client

# 2. 构建前端
npm run build

# 3. 同步到 iOS 工程
npx cap sync ios

# 4. 打开 Xcode 运行
npx cap open ios
# 然后在 Xcode 中按 ⌘R 运行
```

---

## 附：文件结构

```
client/
├── capacitor.config.ts      # Capacitor 配置（App 名、包名、构建目录）
├── vite.config.ts           # Vite 构建配置（base: './' 已配置）
├── .env.development         # 开发环境变量（API 走代理）
├── .env.production          # 生产环境变量（API → trandsai.com）
├── dist/                    # 前端构建产物（npm run build 生成）
├── ios/                     # iOS 原生工程 ← 打包 IPA 从这里出
│   └── App/
│       ├── App.xcworkspace  # ← 用 Xcode 打开这个文件
│       ├── App/
│       │   ├── AppDelegate.swift   # App 入口
│       │   ├── Info.plist         # App 配置（权限、版本号等）
│       │   └── public/            # 前端资源同步到这里
│       └── Package.swift          # Swift 包依赖
├── android/                 # Android 原生工程（另一套打包流程）
├── src/                     # React 源代码
├── APP打包说明.md            # Android 打包说明
└── IOS打包说明.md            # 本文档
```

---

## 快速参考命令

```bash
# 安装 Xcode 命令行工具路径切换
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# 查看 Xcode 版本
xcodebuild -version

# 安装 iOS 平台（已完成，无需重复执行）
npm install @capacitor/ios
npx cap add ios

# 日常打包三步曲
npm run build              # 构建前端
npx cap sync ios           # 同步到 iOS
npx cap open ios           # 打开 Xcode

# 仅同步不打开 Xcode
npx cap copy ios

# 更新原生插件
npm install @capacitor/xxx@latest
npx cap sync ios
```
