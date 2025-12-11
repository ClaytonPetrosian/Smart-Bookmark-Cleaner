import fs from 'fs-extra';
import * as cheerio from 'cheerio';
import axios from 'axios';
import pLimit from 'p-limit';
import https from 'https';
import readline from 'readline';

// ==========================================
//  配置区
// ==========================================
const API_KEY = "xxx"; // 填入你的API_KEY
const MODEL_ID = "deepseek-v3-2-251201";
const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"; 

const INPUT_FILE = './bookmarks.html';           
const REPORT_FILE = './bookmarks_report.json';   
const CLEAN_HTML_FILE = './bookmarks_new.html';  

const CONCURRENT_LIMIT = 5; 
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

const CATEGORIES = [
    "技术/前端开发/Vue", "技术/前端开发/React", "技术/前端开发/工程化",
    "技术/后端架构/Nodejs", "技术/后端架构/数据库", 
    "技术/人工智能", "技术/DevOps",
    "工具/在线服务", "设计/UI与素材", 
    "阅读/资讯博客", "生活/娱乐购物", "学习/教程文档", 
    "资产/金融理财", "其他杂项"
];

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const HEADERS = { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36' };
const SPAM_KEYWORDS = ['domain for sale', 'buy this domain', 'parked free', 'godaddy'];

// 全局变量
let processedCount = 0;
let globalResults = []; 
let errorLock = Promise.resolve(); 

// ==========================================
//  监听中断信号
// ==========================================
process.on('SIGINT', async () => {
    console.log('\n\n🛑 检测到中断信号 (Ctrl+C)...');
    console.log(`💾 正在紧急保存当前进度 (共 ${globalResults.length} 条)...`);
    try {
        await saveProgress(globalResults);
        console.log('✅ 保存完毕，程序安全退出。');
    } catch (e) {
        console.error('❌ 保存失败:', e);
    }
    process.exit(0);
});

// ==========================================
//  交互逻辑
// ==========================================

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(query, (ans) => { rl.close(); resolve(ans); });
    });
}

async function handleCriticalError(error, title) {
    const currentLock = errorLock;
    let unlock;
    errorLock = new Promise(resolve => unlock = resolve);
    await currentLock;

    try {
        console.log('\n\n=========================================');
        console.log(`🛑 严重API错误 (需人工干预)`);
        console.log(`书签: [${title}]`);
        console.log(`错误: ${error.message || 'Unknown Error'}`);
        console.log('=========================================\n');
        process.stdout.write('\x07'); 
        
        const ans = await askQuestion('👉 操作 (y:忽略本次/n:停止并保存): ');
        if (ans.toLowerCase() === 'n') {
            await saveProgress(globalResults);
            process.exit(0);
        }
    } finally {
        unlock();
    }
}

// ==========================================
//  核心逻辑
// ==========================================

async function categorize(title, url, originalPath) {
    let retries = 0;
    while (retries <= MAX_RETRIES) {
        try {
            const payload = {
                model: MODEL_ID,
                messages: [
                    {
                        role: "system",
                        content: `你是一个书签整理专家。请根据【标题】、【URL】和【原路径】进行分类。
请尽量使用多级目录结构，用 "/" 分隔，例如 "技术/前端/Vue"。
可选分类参考：[${CATEGORIES.join(', ')}]，你也可以根据内容生成更合适的层级目录。
只返回分类路径字符串，不要其他内容。`
                    },
                    { role: "user", content: `标题: ${title}\nURL: ${url}\n原路径: ${originalPath}` }
                ],
                temperature: 0.3
            };

            const response = await axios.post(API_URL, payload, {
                headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                timeout: 10000 
            });

            return response.data?.choices?.[0]?.message?.content?.trim() || "其他杂项";

        } catch (error) {
            const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
            const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
            const isServerBusy = error.response && error.response.status >= 500;

            if (isTimeout || isNetworkError || isServerBusy) {
                retries++;
                if (retries <= MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue; 
                } else {
                    return null;
                }
            }
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                await handleCriticalError(error, title);
                return null;
            }
            return null;
        }
    }
}

async function checkLinkHealth(link) {
    try {
        const response = await axios.get(link.url, {
            timeout: TIMEOUT_MS, headers: HEADERS, httpsAgent: httpsAgent,
            maxRedirects: 3, validateStatus: (s) => s < 500
        });
        if (response.status === 404) return { status: 'DEAD', msg: '404' };
        const body = typeof response.data === 'string' ? response.data.toLowerCase() : '';
        if (SPAM_KEYWORDS.some(kw => body.includes(kw))) return { status: 'SPAM', msg: 'Spam' };
        return { status: 'ALIVE', msg: 'OK' };
    } catch (e) { return { status: 'DEAD', msg: e.message }; }
}

async function processBookmark(link, enableAI, totalCount) {
    // 1. 链接健康检测
    const health = await checkLinkHealth(link);
    let resultItem = { ...link, ...health, finalCategory: link.originalPath };

    // 2. 根据结果处理，并在【打印日志前】才生成序号
    if (health.status !== 'ALIVE') {
        const currentIdx = ++processedCount; // 🔥 修正：完成时才计数
        console.log(`\x1b[31m[%d/%d] 🔴 失效: ${link.title.substring(0,20)}... (${health.msg})\x1b[0m`, currentIdx, totalCount);
        globalResults.push(resultItem);
        return resultItem;
    }

    if (enableAI) {
        const newCat = await categorize(link.title, link.url, link.originalPath);
        const currentIdx = ++processedCount; // 🔥 修正：完成时才计数
        
        if (newCat) {
            console.log(`\x1b[32m[%d/%d] 🟢 AI分类: ${link.title.substring(0,20)}...\x1b[0m\n      └─ ${newCat}`, currentIdx, totalCount);
            resultItem.finalCategory = newCat;
        } else {
             console.log(`\x1b[33m[%d/%d] 🟡 AI跳过(超时/出错): ${link.title.substring(0,20)}...\x1b[0m`, currentIdx, totalCount);
        }
    } else {
        const currentIdx = ++processedCount; // 🔥 修正：完成时才计数
        console.log(`[%d/%d] ⚪️ 原样保留: ${link.title.substring(0,20)}...`, currentIdx, totalCount);
    }
    
    globalResults.push(resultItem);
    return resultItem;
}

async function parseBookmarks(filePath) {
    const html = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);
    const links = [];
    $('a').each((i, elem) => {
        const url = $(elem).attr('href');
        const title = $(elem).text();
        if (!url?.startsWith('http')) return;
        const paths = $(elem).parents('dl').map((idx, dl) => $(dl).prev('h3').text().trim()).get();
        links.push({ title, url, originalPath: paths.reverse().filter(p=>p).join('/') || '未分类', status: 'PENDING' });
    });
    return links;
}

function generateNetscapeHTML(bookmarks) {
    const root = { children: {}, files: [] };
    bookmarks.forEach(b => {
        let pathStr = "";
        if (b.status === 'ALIVE') {
            pathStr = b.finalCategory.replace(/\s\/\s/g, '/');
        } else {
            pathStr = "🗑️ 失效归档/" + (b.originalPath.replace(/\s\/\s/g, '/') || "未知位置");
            b.title = `[失效] ${b.title}`;
        }
        const parts = pathStr.split('/').map(s => s.trim()).filter(s => s);
        let currentNode = root;
        parts.forEach(part => {
            if (!currentNode.children[part]) currentNode.children[part] = { children: {}, files: [] };
            currentNode = currentNode.children[part];
        });
        currentNode.files.push(b);
    });

    function buildHtml(node) {
        let html = '';
        for (const [folderName, childNode] of Object.entries(node.children)) {
            html += `    <DT><H3>${folderName}</H3>\n    <DL><p>\n`;
            html += buildHtml(childNode);
            html += `    </DL><p>\n`;
        }
        node.files.forEach(item => {
            html += `        <DT><A HREF="${item.url}">${item.title}</A>\n`;
        });
        return html;
    }

    return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
    ${buildHtml(root)}    </DL><p>`;
}

async function loadProgress() {
    if (fs.existsSync(REPORT_FILE)) {
        try {
            const data = await fs.readJson(REPORT_FILE);
            if (Array.isArray(data) && data.length > 0) return data;
        } catch (e) { }
    }
    return [];
}

async function saveProgress(results) {
    if (results.length === 0) return;
    const uniqueResults = [];
    const seenUrls = new Set();
    [...results].reverse().forEach(item => {
        if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            uniqueResults.push(item);
        }
    });
    const finalData = uniqueResults.reverse();
    await fs.writeJson(REPORT_FILE, finalData, { spaces: 2 });
    await fs.writeFile(CLEAN_HTML_FILE, generateNetscapeHTML(finalData));
    console.log(`\n💾 进度已保存`);
}

// --- 执行区 ---
(async () => {
    if (!fs.existsSync(INPUT_FILE)) return console.error("❌ 找不到 bookmarks.html");
    const allLinks = await parseBookmarks(INPUT_FILE);
    const existingProgress = await loadProgress();
    let linksToProcess = allLinks;

    if (existingProgress.length > 0) {
        const ans = await askQuestion(`检测到旧进度 (${existingProgress.length}条)，是否继续? (y/n): `);
        if (ans.toLowerCase() === 'y') {
            globalResults = [...existingProgress];
            processedCount = existingProgress.length;
            const processedUrls = new Set(existingProgress.map(item => item.url));
            linksToProcess = allLinks.filter(link => !processedUrls.has(link.url));
            console.log(`🔄 恢复进度，剩余 ${linksToProcess.length} 条。`);
        } else {
            globalResults = [];
            processedCount = 0;
        }
    }

    if (linksToProcess.length === 0) return console.log('🎉 处理完毕。');

    const enableAI = (await askQuestion('是否启用 AI 分类? (y/n): ')).toLowerCase() === 'y';
    console.log('💡 Ctrl+C 可中断并保存。');
    
    const limit = pLimit(CONCURRENT_LIMIT);
    const tasks = linksToProcess.map(link => limit(() => processBookmark(link, enableAI, allLinks.length)));
    
    await Promise.all(tasks);
    console.log('\n✅ 完成！');
    await saveProgress(globalResults);
})();