# 📑 Smart Bookmark Cleaner (AI 书签整理助手)

[English Version](https://www.google.com/search?q=%23smart-bookmark-cleaner) | [中文版本](https://www.google.com/search?q=%23ai-%E4%B9%A6%E7%AD%BE%E6%95%B4%E7%90%86%E5%8A%A9%E6%89%8B)

-----

## AI 书签整理助手

**Smart Bookmark Cleaner** 是一个基于 Node.js 的强大命令行工具，旨在解决“数字囤积”问题。它不仅能检测书签的有效性，还能利用 AI 大模型（LLM）根据网页内容自动重新归类你的书签，让混乱的收藏夹焕然一新。

### ✨ 核心功能

  * **🔍 深度链接健康检测**：
      * 识别 HTTP 404、DNS 解析错误、超时等失效链接。
      * **智能识别“软 404” (Soft 404)**：通过关键词检测（如 "domain for sale", "parked free"），识别那些虽然返回 200 状态码但实际已变成广告页或域名售卖页的垃圾链接。
  * **🤖 AI 智能分类**：
      * 调用大模型 API（兼容 OpenAI/火山引擎等接口），根据网页标题、URL 和**原始目录路径**，智能推断书签的最佳分类。
      * 支持生成多级目录结构（如 `技术/前端/Vue`）。
  * **📂 目录结构保留**：
      * 采用递归算法，完美重建嵌套的文件夹结构。
      * 失效链接不会被直接删除，而是被归档到 `🗑️ 失效归档` 目录下，保留原路径信息，防止误删。
  * **⏯️ 断点续传 & 进度保存**：
      * 支持 `Ctrl + C` 随时中断，脚本会自动保存当前进度。
      * 再次运行时，会自动检测上次的进度文件并询问是否继续，无需从头开始。
      * 网络超时或 AI 报错会自动重试，严重错误时支持人工干预。
  * **🚀 高并发处理**：
      * 使用 `p-limit` 控制并发请求数，既保证速度又防止被目标网站封锁。

### 🛠️ 环境要求

  * Node.js (建议 v14.0 或更高版本)
  * npm 或 yarn

### 🚀 快速开始

#### 1\. 安装依赖

下载或克隆本项目后，在项目根目录下运行：

```bash
npm install
```

#### 2\. 导出书签

1.  在 Chrome 浏览器中打开书签管理器 (`chrome://bookmarks/`)。
2.  点击右上角菜单 -\> **导出书签**。
3.  将导出的文件重命名为 `bookmarks.html`，并放入本项目根目录。

#### 3\. 配置参数 (重要)

打开 `bookmark_manager.js` 文件，根据你的需求修改顶部的配置区：

```javascript
// --- 配置区 ---
const API_KEY = "YOUR_API_KEY"; // 填入你的 AI API Key
const MODEL_ID = "doubao-seed-1-6-lite-251015"; // 模型 ID
const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"; // API 接口地址

const CONCURRENT_LIMIT = 5; // 并发数 (建议 5-20)
const TIMEOUT_MS = 15000;   // 请求超时时间
```

> **注意**：本项目默认适配 OpenAI 格式的接口（如火山引擎/豆包、DeepSeek、ChatGPT 等）。

#### 4\. 运行脚本

```bash
node bookmark_manager.js
```

#### 5\. 交互操作

  * 脚本启动后会读取 `bookmarks.html`。
  * 如果检测到上次未完成的进度，会询问是否**恢复进度**。
  * 询问是否开启 **AI 智能分类**（输入 `y` 开启，`n` 仅清理死链）。
  * 运行结束后，会生成 `bookmarks_new.html`。

#### 6\. 导入新书签

1.  为了安全起见，建议先在 Chrome 中新建一个用户配置进行测试。
2.  进入书签管理器 -\> **导入书签**。
3.  选择生成的 `bookmarks_new.html` 文件。

### 📄 输出文件说明

  * `bookmarks_report.json`: 包含所有书签检测状态、AI 分类结果的详细数据报告（也是断点续传的依据）。
  * `bookmarks_new.html`: 清理并重组后的最终文件，符合 Netscape Bookmark 标准格式。

### ⚠️ 免责声明

  * 本工具会向目标网站发送请求以检测连通性，请合理设置并发数，避免对目标网站造成压力。
  * 虽然脚本包含失效归档功能，但在删除旧书签前，**请务必备份原始书签文件**。
  * AI 分类结果仅供参考，准确度取决于所使用的模型能力。

-----

## Smart Bookmark Cleaner

**Smart Bookmark Cleaner** is a powerful Node.js command-line tool designed to solve the problem of "digital hoarding." It not only detects the validity of bookmarks but also uses AI (LLM) to automatically recategorize your messy favorites based on their content.

### ✨ Key Features

  * **🔍 Advanced Link Health Check**:
      * Detects dead links including HTTP 404, DNS errors, and timeouts.
      * **"Soft 404" Detection**: Identifies spam pages (e.g., "domain for sale", "parked free") that return a 200 status code but contain no useful content.
  * **🤖 AI Categorization**:
      * Utilizes LLM APIs (compatible with OpenAI/Volcengine) to categorize bookmarks based on Title, URL, and **Original Folder Path**.
      * Supports generating deep, multi-level folder structures (e.g., `Tech/Frontend/Vue`).
  * **📂 Structure Preservation**:
      * Uses a recursive algorithm to rebuild nested folder structures.
      * Dead links are **not deleted** but moved to a `🗑️ Archived (Dead)` folder, preserving their original path info for future reference.
  * **⏯️ Resumable & Safe Interruption**:
      * Press `Ctrl + C` at any time to safely pause and save progress.
      * Automatically detects previous progress upon restart, allowing you to resume where you left off.
      * Includes auto-retry for network timeouts and manual intervention for critical API errors.
  * **🚀 High Concurrency**:
      * Uses `p-limit` to manage concurrent requests, ensuring speed while avoiding IP bans.

### 🛠️ Prerequisites

  * Node.js (v14.0 or higher recommended)
  * npm or yarn

### 🚀 Quick Start

#### 1\. Install Dependencies

Clone the repository and run the following command in the root directory:

```bash
npm install
```

#### 2\. Export Bookmarks

1.  Open the Bookmark Manager in Chrome (`chrome://bookmarks/`).
2.  Click the menu icon -\> **Export Bookmarks**.
3.  Rename the exported file to `bookmarks.html` and place it in the project root directory.

#### 3\. Configuration

Open `bookmark_manager.js` and edit the configuration section at the top:

```javascript
// --- Configuration ---
const API_KEY = "YOUR_API_KEY"; // Your AI API Key
const MODEL_ID = "doubao-seed-1-6-lite-251015"; // Model ID
const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"; // API Endpoint

const CONCURRENT_LIMIT = 5; // Concurrency limit (5-20 recommended)
const TIMEOUT_MS = 15000;   // Request timeout in ms
```

> **Note**: This tool supports any OpenAI-compatible API format.

#### 4\. Run the Script

```bash
node bookmark_manager.js
```

#### 5\. Interaction

  * The script reads `bookmarks.html`.
  * It checks for previous progress and asks if you want to **Resume**.
  * It asks if you want to enable **AI Categorization** (`y` for yes, `n` for clean-up only).
  * Upon completion, `bookmarks_new.html` is generated.

#### 6\. Import Bookmarks

1.  Go to Chrome Bookmark Manager -\> **Import Bookmarks**.
2.  Select the generated `bookmarks_new.html`.

### 📄 Output Files

  * `bookmarks_report.json`: A detailed JSON report containing the status and category of every bookmark. This file is also used for the resume functionality.
  * `bookmarks_new.html`: The final cleaned and reorganized file, ready to be imported into any browser supporting the Netscape Bookmark format.

### ⚠️ Disclaimer

  * Please back up your original bookmarks before deleting anything.
  * Use a reasonable concurrency limit to avoid being blocked by websites.
  * AI categorization accuracy depends on the model used.

-----

### 📝 License


ISC / MIT (Choose your license)

