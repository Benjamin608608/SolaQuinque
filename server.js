const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const { google } = require('googleapis');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// 筆記功能
const { NotesDB, initDatabase } = require('./database');
const { PostgreSQLNotesDB, initPostgreSQLDatabase } = require('./database-pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 全局變數
let globalAssistant = null;
let processingRequests = new Map();
const CACHE_DURATION = 0; // 暫時禁用緩存以測試修復效果
let assistantWarmupInterval = null; // 定期保溫計時器
let isWarmedUp = false; // 追蹤是否已預熱

// 作者對照表
let authorTranslations = {};

// 載入作者對照表
async function loadAuthorTranslations() {
    try {
        const filePath = path.join(__dirname, 'config', 'author-translations.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            authorTranslations = JSON.parse(data);
            console.log(`✅ 已載入作者對照表 (${Object.keys(authorTranslations).length} 位作者)`);
        } else {
            console.warn('⚠️ 作者對照表文件不存在');
            authorTranslations = {};
        }
    } catch (error) {
        console.error('❌ 載入作者對照表失敗:', error.message);
        authorTranslations = {};
    }
}

// 翻譯檔案名稱
function translateFileName(fileName, language = 'zh') {
  if (!fileName || language !== 'zh') return fileName;
  
  // 簡化版本：基本翻譯
  return fileName
    .replace(/Commentary/gi, '註釋')
    .replace(/Sermons/gi, '講道集')
    .replace(/Letters/gi, '書信集')
    .replace(/Works/gi, '作品集');
}

// 獲取作者名稱（根據語言）
function getAuthorName(englishName, language = 'zh') {
  if (!englishName) return '';
  
  if (language === 'zh' && authorTranslations && authorTranslations.authors && authorTranslations.authors[englishName]) {
    return authorTranslations.authors[englishName];
  }
  return englishName;
}

// 讓 express-session 支援 proxy (如 Railway/Heroku/Render)
app.set('trust proxy', 1);

// 🛡️ API 速率限制配置
// 管理員白名單 - 不受任何限制
const adminEmails = [
  'benjamin608608@gmail.com'
];

// 檢查是否為管理員的中間件
function isAdmin(req) {
  return req.user && req.user.email && adminEmails.includes(req.user.email);
}

// 通用 API 限制 - 防止濫用（管理員免疫）
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制每個 IP 15分鐘內最多 100 個請求
  message: {
    error: '請求過於頻繁，請稍後再試',
    retryAfter: '15分鐘後'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 管理員跳過限制
    if (isAdmin(req)) {
      console.log(`🔓 管理員 ${req.user.email} 跳過通用速率限制`);
      return true;
    }
    return false;
  }
});

// 搜尋 API 嚴格限制 - 防止大量查詢（管理員免疫）
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  max: 20, // 限制每個 IP 5分鐘內最多 20 次搜尋
  message: {
    error: '搜尋請求過於頻繁，請稍後再試',
    retryAfter: '5分鐘後'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 管理員跳過限制
    if (isAdmin(req)) {
      console.log(`🔓 管理員 ${req.user.email} 跳過搜尋速率限制`);
      return true;
    }
    return false;
  }
});

// 聖經註釋 API 限制 - 防止濫用 AI 資源（管理員免疫）
const bibleExplainLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 分鐘
  max: 15, // 限制每個 IP 10分鐘內最多 15 次註釋請求
  message: {
    error: '註釋請求過於頻繁，請稍後再試',
    retryAfter: '10分鐘後'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 管理員跳過限制
    if (isAdmin(req)) {
      console.log(`🔓 管理員 ${req.user.email} 跳過註釋速率限制`);
      return true;
    }
    return false;
  }
});

// 聖經閱讀 API 限制 - 較寬鬆的限制供正常閱讀（管理員免疫）
const bibleReadingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  max: 200, // 限制每個 IP 5分鐘內最多 200 次聖經閱讀請求（約每1.5秒一次）
  message: {
    error: '聖經閱讀請求過於頻繁，請稍候片刻',
    retryAfter: '5分鐘後'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 管理員跳過限制
    if (isAdmin(req)) {
      console.log(`🔓 管理員 ${req.user.email} 跳過聖經閱讀速率限制`);
      return true;
    }
    return false;
  }
});

// 管理員IP白名單 (可選 - 用於登入限制豁免)
const adminIPs = [
  '::1', // localhost IPv6
  '127.0.0.1', // localhost IPv4
  // 可以添加您的固定IP
];

// 登入相關嚴格限制 - 防止暴力破解（管理員IP免疫）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 50, // 提高管理員的登入嘗試次數到50次
  message: {
    error: '登入嘗試過於頻繁，請稍後再試',
    retryAfter: '15分鐘後'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 檢查是否為管理員IP（本地開發）
    const clientIP = req.ip || req.connection.remoteAddress;
    if (adminIPs.includes(clientIP)) {
      console.log(`🔓 管理員IP ${clientIP} 跳過登入速率限制`);
      return true;
    }
    return false;
  }
});

// 減速中間件 - 漸進式延遲響應
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  delayAfter: 50, // 允許前 50 個請求正常速度
  delayMs: () => 500, // 固定延遲 500ms（新版本語法）
  maxDelayMs: 5000, // 最大延遲 5 秒
  validate: {
    delayMs: false // 禁用警告訊息
  }
});

// 🚀 暫時移除所有速率限制以優化性能
// app.use(generalLimiter);
// app.use(speedLimiter);

// 初始化 OpenAI 客戶端 - 優化連接設定
const { Agent } = require('http');
const { Agent: HttpsAgent } = require('https');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 增加到30秒超時，適應網路較慢的環境
  maxRetries: 2, // OpenAI SDK 內建重試
  httpAgent: new Agent({ 
    keepAlive: true,
    keepAliveMsecs: 60000, // 增加到60秒
    maxSockets: 5, // 減少併發連接數
    timeout: 30000
  }),
  httpsAgent: new HttpsAgent({ 
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 5,
    timeout: 30000
  }),
});

// 模型設定：使用 gpt-4o-mini
const ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

// 簡易 LRU/TTL 快取：聖經經文解釋 & 每卷向量庫 ID
// 需求：經文解釋不使用快取 → 直接關閉即可
const DISABLE_BIBLE_EXPLAIN_CACHE = true;
const bibleExplainCache = new Map(); // key => { data, ts }
const BIBLE_EXPLAIN_TTL_MS = 1000 * 60 * 30; // 30 分鐘

const vectorStoreIdCache = new Map(); // name(lowercased) => { id, ts }
const VECTOR_STORE_ID_TTL_MS = 1000 * 60 * 60 * 6; // 6 小時

function getBibleExplainCached(key) {
  if (DISABLE_BIBLE_EXPLAIN_CACHE) return null;
  const item = bibleExplainCache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > BIBLE_EXPLAIN_TTL_MS) {
    bibleExplainCache.delete(key);
    return null;
  }
  return item.data;
}

function setBibleExplainCached(key, data) {
  if (DISABLE_BIBLE_EXPLAIN_CACHE) return;
  bibleExplainCache.set(key, { data, ts: Date.now() });
}

async function getVectorStoreIdCachedByName(name) {
  const k = (name || '').toLowerCase();
  const hit = vectorStoreIdCache.get(k);
  if (hit && Date.now() - hit.ts <= VECTOR_STORE_ID_TTL_MS) return hit.result;
  const result = await findVectorStoreIdByName(name);
  if (result) vectorStoreIdCache.set(k, { result, ts: Date.now() });
  return result;
}

// 從聖經註釋內容中提取作者名稱作為來源（備用機制）
function extractAuthorsFromContent(content, language = 'zh') {
  const sources = [];
  const seenAuthors = new Set();
  let index = 1;
  
  try {
    // 匹配 **作者名稱** 格式，包含年代
    const authorMatches = content.match(/\*\*([^*]+?(?:\([^)]+\))?[^*]*?)\*\*/g);
    if (authorMatches) {
      for (const match of authorMatches) {
        const authorName = match.replace(/\*\*/g, '').trim();
        
        // 更嚴格的作者名稱檢測
        const isAuthor = (
          authorName.length > 3 && 
          authorName.length < 100 &&
          // 包含年代格式 (YYYY-YYYY) 或常見神學家名稱
          (authorName.includes('(') && authorName.includes(')')) ||
          authorName.includes('亨利') ||
          authorName.includes('加爾文') ||
          authorName.includes('萊奧波德') ||
          authorName.includes('馬丁路德') ||
          authorName.includes('Henry') ||
          authorName.includes('Calvin') ||
          authorName.includes('Leopold') ||
          authorName.includes('Luther')
        ) && 
        // 排除非作者名稱
        !authorName.includes('神的兒子') && 
        !authorName.includes('創世紀') &&
        !authorName.includes('聖經') &&
        !authorName.includes('經文') &&
        !seenAuthors.has(authorName);
        
        if (isAuthor) {
          seenAuthors.add(authorName);
          
          // 嘗試翻譯作者名稱
          const translatedName = getAuthorName(authorName, language);
          const displayName = translatedName !== authorName ? translatedName : authorName;
          
          // 嘗試從內容中找到與作者相關的書名信息
          const authorSection = extractAuthorSection(content, authorName);
          const bookTitle = extractBookTitleFromSection(authorSection);
          
          // 構建完整的來源信息
          let fullSourceInfo = displayName;
          if (bookTitle) {
            fullSourceInfo += ` - ${bookTitle}`;
          }
          
          sources.push({
            index: index++,
            fileName: fullSourceInfo,
            quote: '',
            fileId: `extracted_${index}`
          });
        }
      }
    }
    
    return sources;
    
  } catch (error) {
    console.error('提取作者信息失敗:', error.message);
    return [];
  }
}

// 新增：從內容中提取作者段落
function extractAuthorSection(content, authorName) {
  try {
    const authorPattern = new RegExp(`\\*\\*${escapeRegex(authorName)}\\*\\*([\\s\\S]*?)(?=\\*\\*[^*]+\\*\\*|$)`, 'i');
    const match = content.match(authorPattern);
    return match ? match[1] : '';
  } catch (error) {
    return '';
  }
}

// 新增：從段落中提取書名
function extractBookTitleFromSection(section) {
  try {
    // 匹配常見的書名格式
    const titlePatterns = [
      /《([^》]+)》/g,  // 中文書名 《...》
      /"([^"]+)"/g,     // 英文書名 "..."
      /《([^》]+)》/g,  // 全形書名
      /Commentary on ([^,\.]+)/gi,  // Commentary on ...
      /on ([A-Z][a-z]+ \d+)/g      // on Matthew 5
    ];
    
    for (const pattern of titlePatterns) {
      const matches = section.match(pattern);
      if (matches && matches[0]) {
        // 提取第一個找到的書名
        let title = matches[0];
        title = title.replace(/[《》"]/g, '').trim();
        if (title.startsWith('Commentary on ')) {
          title = title.replace('Commentary on ', '');
        }
        if (title.length > 5 && title.length < 100) {  // 合理的書名長度
          return title;
        }
      }
    }
    return '';
  } catch (error) {
    return '';
  }
}

// 新增：正則表達式轉義函數
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 解析訊息中的所有檔案引用，並解析為 { fileId, fileName, quote }
function cleanFileName(name) {
  try {
    if (!name) return '';
    // 去副檔名、底線轉空白、修剪
    return String(name).replace(/\.[^./\\\s]+$/,'').replace(/[_]+/g,' ').trim();
  } catch { return name || ''; }
}

async function resolveMessageFileCitations(message) {
  try {
    if (!message || !Array.isArray(message.content)) return [];
    const annotations = [];
    for (const part of message.content) {
      const anns = part?.text?.annotations || [];
      for (const a of anns) {
        if (a?.type === 'file_citation') annotations.push(a);
      }
    }
    if (annotations.length === 0) return [];

    // 依 file_id 去重
    const idToQuote = new Map();
    for (const a of annotations) {
      const id = a?.file_citation?.file_id || a?.file_id || a?.id || a?.text || '';
      if (!id) continue;
      // 優先保留第一段 quote（避免過長）
      if (!idToQuote.has(id)) {
        const quote = (a?.quote || a?.text || '').toString();
        idToQuote.set(id, quote);
      }
    }

    const results = [];
    for (const [fid, quote] of idToQuote.entries()) {
      try {
        const f = await openai.files.retrieve(fid);
        results.push({ fileId: fid, fileName: cleanFileName(f?.filename || ''), quote: quote });
      } catch {
        results.push({ fileId: fid, fileName: '', quote: quote });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// 你的向量資料庫 ID
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID || 'vs_6886f711eda0819189b6c017d6b96d23';

// MongoDB Atlas 連線
let mongoClient, loginLogsCollection;

async function connectToMongoDB() {
  if (!process.env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI 環境變數未設置，MongoDB 功能將不可用');
    return;
  }
  
  try {
    mongoClient = new MongoClient(process.env.MONGO_URI, { 
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    await mongoClient.connect();
    const db = mongoClient.db('theologian');
    loginLogsCollection = db.collection('loginLogs');
    console.log('✅ 已連線 MongoDB Atlas (theologian.loginLogs)');
  } catch (err) {
    console.error('❌ 連線 MongoDB Atlas 失敗:', err.message);
    console.log('💡 應用程式將繼續運行，但登入記錄功能將不可用');
  }
}

// 初始化 MongoDB 連線
connectToMongoDB();

// Session 配置（改良版，支援移動設備）
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true, // 需要為 OAuth 初始請求保存未初始化的會話
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 只在生產環境使用 secure
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 小時
    sameSite: 'lax' // 改善移動設備相容性（對 OAuth 友好）
  },
  name: 'theologian.sid' // 自定義 session cookie 名稱
}));

// Passport 配置
app.use(passport.initialize());
app.use(passport.session());

// Passport 序列化
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// 條件性 Google OAuth 配置
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
    },
    function(accessToken, refreshToken, profile, cb) {
      // 這裡可以添加用戶資料庫存儲邏輯
      const user = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        picture: profile.photos[0].value
      };
      return cb(null, user);
    }
  ));
} else {
  console.warn('⚠️  Google OAuth 憑證未設置，登入功能將不可用');
  console.warn('   請設置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 環境變數');
}

// 中間件設置
app.use(cors({
  origin: true, // 允許所有來源
  credentials: true, // 允許攜帶憑證
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// 認證中間件
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ 
    success: false, 
    error: '需要登入才能使用此功能',
    requiresAuth: true 
  });
}

// 檢測是否為 LINE 瀏覽器
function isLineBrowser(userAgent) {
  return userAgent && (
    userAgent.includes('Line') || 
    userAgent.includes('LINE') ||
    userAgent.includes('line')
  );
}

// 檢測是否為內建瀏覽器
function isEmbeddedBrowser(userAgent) {
  return userAgent && (
    userAgent.includes('Line') ||
    userAgent.includes('Instagram') ||
    userAgent.includes('Facebook') ||
    userAgent.includes('Twitter') ||
    userAgent.includes('WhatsApp') ||
    userAgent.includes('Telegram') ||
    userAgent.includes('WeChat')
  );
}

// 獲取當前完整 URL
function getCurrentUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}${req.originalUrl}`;
}

// 認證路由 - 僅在 Google OAuth 已配置時啟用
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google', (req, res) => {
    const userAgent = req.get('User-Agent');
    const currentUrl = getCurrentUrl(req);
    
    // 檢測是否為內建瀏覽器
    if (isEmbeddedBrowser(userAgent)) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>請使用外部瀏覽器登入</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .btn {
              background: #4285f4;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              text-decoration: none;
              display: inline-block;
              margin: 10px;
              font-size: 16px;
              cursor: pointer;
            }
            .btn:hover {
              background: #3367d6;
            }
            .btn-secondary {
              background: #6c757d;
            }
            .btn-secondary:hover {
              background: #545b62;
            }
            .steps {
              text-align: left;
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .steps ol {
              margin: 0;
              padding-left: 20px;
            }
            .steps li {
              margin-bottom: 10px;
              color: #555;
            }
            .url-box {
              background: #e9ecef;
              padding: 10px;
              border-radius: 6px;
              margin: 15px 0;
              word-break: break-all;
              font-family: monospace;
              font-size: 12px;
            }
            .copy-btn {
              background: #28a745;
              color: white;
              padding: 8px 16px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              margin-top: 10px;
            }
            .copy-btn:hover {
              background: #218838;
            }
            .success {
              color: #28a745;
              font-weight: bold;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">🌐</div>
            <h1>請使用外部瀏覽器登入</h1>
            <p>由於 Google 安全政策，無法在當前瀏覽器中完成登入。</p>
            
            <div class="steps">
              <h3>解決步驟：</h3>
              <ol>
                <li>點擊右上角的「...」或「更多選項」</li>
                <li>選擇「在瀏覽器中開啟」或「複製連結」</li>
                <li>在 Chrome、Safari 等外部瀏覽器中開啟</li>
                <li>完成 Google 登入</li>
              </ol>
            </div>
            
            <div class="url-box" id="urlBox">${currentUrl}</div>
            <button class="copy-btn" onclick="copyUrl()">複製連結</button>
            <div id="copyStatus"></div>
            
            <div style="margin-top: 20px;">
              <a href="/" class="btn btn-secondary">返回首頁</a>
              <button class="btn" onclick="openInNewWindow()">在新視窗開啟</button>
            </div>
          </div>
          
          <script>
            function copyUrl() {
              const url = '${currentUrl}';
              if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                  document.getElementById('copyStatus').innerHTML = '<div class="success">✅ 連結已複製到剪貼簿</div>';
                });
              } else {
                // 降級方案
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                document.getElementById('copyStatus').innerHTML = '<div class="success">✅ 連結已複製到剪貼簿</div>';
              }
            }
            
            function openInNewWindow() {
              const url = '${currentUrl}';
              try {
                window.open(url, '_blank');
              } catch (e) {
                alert('無法開啟新視窗，請手動複製連結到外部瀏覽器');
              }
            }
            
            // 自動嘗試開啟新視窗（如果可能）
            setTimeout(() => {
              try {
                window.open('${currentUrl}', '_blank');
              } catch (e) {
                // 靜默失敗
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    }
    
    // 正常流程
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account',
      access_type: 'offline',
      include_granted_scopes: true
    })(req, res);
  });

  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    async function(req, res) {
      // 寫入登入紀錄到 MongoDB Atlas
      if (loginLogsCollection && req.user) {
        try {
          await loginLogsCollection.insertOne({
            email: req.user.email,
            name: req.user.name,
            loginAt: new Date(),
            googleId: req.user.id,
            picture: req.user.picture
          });
          console.log(`[登入紀錄] ${req.user.email} ${req.user.name}`);
        } catch (err) {
          console.error('寫入登入紀錄失敗:', err.message);
        }
      }
      res.redirect('/');
    }
  );
} else {
  // 如果 Google OAuth 未配置，提供友好的錯誤頁面
  app.get('/auth/google', (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google 登入暫時不可用</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .btn {
            background: #4285f4;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            transition: background 0.3s;
          }
          .btn:hover {
            background: #3367d6;
          }
          .btn-secondary {
            background: #6c757d;
          }
          .btn-secondary:hover {
            background: #5a6268;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🔧</div>
          <h1>Google 登入暫時不可用</h1>
          <p>Google OAuth 功能尚未配置。管理員正在設置中，請稍後再試。</p>
          <p>如果您是管理員，請參考 <code>scripts/setup-google-oauth.md</code> 文件進行設置。</p>
          <a href="/" class="btn">返回首頁</a>
          <a href="/api/health" class="btn btn-secondary">檢查系統狀態</a>
        </div>
      </body>
      </html>
    `);
  });
}

app.get('/auth/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});



// 獲取用戶資訊
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    const userIsAdmin = isAdmin(req);
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        isAdmin: userIsAdmin // 添加管理員狀態
      }
    });
    
    if (userIsAdmin) {
      console.log(`👑 管理員訪問 /api/user: ${req.user.email}`);
    }
  } else {
    res.json({
      success: false,
      user: null
    });
  }
});

// 管理員專用 - 清除速率限制
app.post('/api/admin/clear-rate-limits', (req, res) => {
  if (!req.isAuthenticated() || !isAdmin(req)) {
    return res.status(403).json({
      success: false,
      error: '需要管理員權限'
    });
  }

  try {
    // 清除所有速率限制器的記錄
    generalLimiter.resetKey(req.ip);
    searchLimiter.resetKey(req.ip);
    bibleExplainLimiter.resetKey(req.ip);
    bibleReadingLimiter.resetKey(req.ip);
    authLimiter.resetKey(req.ip);
    
    console.log(`👑 管理員 ${req.user.email} 清除了速率限制 (IP: ${req.ip})`);
    
    res.json({
      success: true,
      message: '速率限制已清除',
      adminAction: true
    });
  } catch (error) {
    console.error('清除速率限制失敗:', error);
    res.status(500).json({
      success: false,
      error: '清除失敗'
    });
  }
});

// 獲取文件名稱的函數
async function getFileName(fileId, language = 'zh') {
  try {
    const file = await openai.files.retrieve(fileId);
    let fileName = file.filename || `檔案-${fileId.substring(0, 8)}`;
    fileName = fileName.replace(/\.(txt|pdf|docx?|rtf|md)$/i, '');
    
    console.log(`🔍 原始文件名: "${fileName}"`);
    
    // 嘗試從檔案名稱中提取作者名稱並翻譯
    // 支援兩種格式：
    // 1. 開頭格式：Herman Bavinck (1854-1921) Philosophy of Revelation
    // 2. 方括號格式：[Charles Haddon Spurgeon (1834-1892)] Spurgeon's Sermons
    
    let translatedAuthorName = null;
    
    // 檢查方括號格式 [Author Name (Year)] 或 [Author Name]
    const bracketMatch = fileName.match(/\[([^\]\n]+?)\]/);
    if (bracketMatch) {
      const bracketContent = bracketMatch[1].trim();
      console.log(`🔍 方括號格式 - 提取到內容: "${bracketContent}"`);
      
      // 檢查是否包含年份格式 (Year)
      const yearMatch = bracketContent.match(/\(([^)]+)\)/);
      if (yearMatch) {
        // 有年份的格式：[Author Name (Year)]
        const englishAuthorName = bracketContent.replace(/\([^)]+\)/, '').trim();
        console.log(`🔍 方括號格式（有年份）- 提取到作者名稱: "${englishAuthorName}"`);
        
        // 嘗試完整匹配（包含年份）
        const fullNameWithYear = bracketContent;
        let translatedAuthorName = getAuthorName(fullNameWithYear, language);
        console.log(`🔍 方括號完整匹配: "${fullNameWithYear}" -> "${translatedAuthorName}"`);
        
        // 如果完整匹配沒有翻譯，嘗試只匹配作者名（不含年份）
        if (!translatedAuthorName || translatedAuthorName === fullNameWithYear) {
          translatedAuthorName = getAuthorName(englishAuthorName, language);
          console.log(`🔍 方括號部分匹配: "${englishAuthorName}" -> "${translatedAuthorName}"`);
        }
        
        // 如果找到了翻譯，替換檔案名稱
        if (translatedAuthorName && translatedAuthorName !== englishAuthorName) {
          // 替換方括號內的作者名稱，保持年份
          const year = yearMatch[1];
          const originalBracket = `[${bracketContent}]`;
          const translatedBracket = `[${translatedAuthorName} (${year})]`;
          fileName = fileName.replace(originalBracket, translatedBracket);
          console.log(`✅ 方括號翻譯成功: "${originalBracket}" -> "${translatedBracket}"`);
        }
      } else {
        // 沒有年份的格式：[Author Name]
        const englishAuthorName = bracketContent;
        console.log(`🔍 方括號格式（無年份）- 提取到作者名稱: "${englishAuthorName}"`);
        
        const translatedAuthorName = getAuthorName(englishAuthorName, language);
        console.log(`🔍 方括號無年份匹配: "${englishAuthorName}" -> "${translatedAuthorName}"`);
        
        // 如果找到了翻譯，替換檔案名稱
        if (translatedAuthorName && translatedAuthorName !== englishAuthorName) {
          const originalBracket = `[${englishAuthorName}]`;
          const translatedBracket = `[${translatedAuthorName}]`;
          fileName = fileName.replace(originalBracket, translatedBracket);
          console.log(`✅ 方括號翻譯成功: "${originalBracket}" -> "${translatedBracket}"`);
        }
      }
    } else {
      // 檢查開頭格式 Author Name (Year)
      const authorMatch = fileName.match(/^([^(]+?)\s*\(/);
      if (authorMatch) {
        const englishAuthorName = authorMatch[1].trim();
        console.log(`🔍 開頭格式 - 提取到作者名稱: "${englishAuthorName}"`);
        
        // 嘗試完整匹配（包含年份）
        const fullNameWithYear = fileName.match(/^([^(]+?\([^)]+\))/);
        if (fullNameWithYear) {
          translatedAuthorName = getAuthorName(fullNameWithYear[1], language);
          console.log(`🔍 開頭完整匹配: "${fullNameWithYear[1]}" -> "${translatedAuthorName}"`);
        }
        
        // 如果沒有找到，嘗試只匹配作者名（不含年份）
        if (!translatedAuthorName || translatedAuthorName === fullNameWithYear[1]) {
          translatedAuthorName = getAuthorName(englishAuthorName, language);
          console.log(`🔍 開頭部分匹配: "${englishAuthorName}" -> "${translatedAuthorName}"`);
        }
        
        // 如果找到了翻譯，替換檔案名稱
        if (translatedAuthorName && translatedAuthorName !== englishAuthorName) {
          // 替換作者名部分（保持年份不變）
          fileName = fileName.replace(englishAuthorName, translatedAuthorName);
          console.log(`✅ 開頭格式翻譯成功: "${englishAuthorName}" -> "${translatedAuthorName}"`);
        } else if (fullNameWithYear) {
          // 如果完整匹配有翻譯，使用完整匹配的翻譯
          const fullName = fullNameWithYear[1];
          const translatedFullName = getAuthorName(fullName, language);
          if (translatedFullName && translatedFullName !== fullName) {
            // 替換整個完整名稱
            fileName = fileName.replace(fullName, translatedFullName);
            console.log(`✅ 開頭完整翻譯成功: "${fullName}" -> "${translatedFullName}"`);
          }
        }
      }
    }
    
    console.log(`📄 最終文件名: "${fileName}"`);
    return fileName;
  } catch (error) {
    console.warn(`無法獲取檔案名稱 ${fileId}:`, error.message);
    return `檔案-${fileId.substring(0, 8)}`;
  }
}

// 處理引用標記並轉換為網頁格式的函數
async function processAnnotationsInText(text, annotations, language = 'zh') {
  let processedText = text;
  const sourceMap = new Map();
  const usedSources = new Map();
  let citationCounter = 1;
  
  if (annotations && annotations.length > 0) {
    // 並行預處理所有檔案名稱
    const fileProcessingPromises = [];
    const annotationMap = new Map();
    
    for (const annotation of annotations) {
      if (annotation.type === 'file_citation' && annotation.file_citation) {
        const fileId = annotation.file_citation.file_id;
        const quote = annotation.file_citation.quote || '';
        
        // 並行處理檔案名稱
        const fileNamePromise = getFileName(fileId, language);
        fileProcessingPromises.push(fileNamePromise);
        annotationMap.set(annotation, { fileId, quote, fileNamePromise });
      }
    }
    
    // 等待所有檔案名稱處理完成
    const fileNames = await Promise.all(fileProcessingPromises);
    let fileNameIndex = 0;
    
    for (const annotation of annotations) {
      if (annotation.type === 'file_citation' && annotation.file_citation) {
        const { fileId, quote } = annotationMap.get(annotation);
        const fileName = fileNames[fileNameIndex++];
        
        let citationIndex;
        if (usedSources.has(fileId)) {
          citationIndex = usedSources.get(fileId);
        } else {
          citationIndex = citationCounter++;
          usedSources.set(fileId, citationIndex);
          sourceMap.set(citationIndex, {
            fileName,
            quote,
            fileId
          });
        }
        
        const originalText = annotation.text;
        
        if (originalText) {
          // 嘗試翻譯註解文本中的作者名稱
          let translatedText = originalText;
          
          console.log(`🔍 開始處理註解文本: "${originalText}"`);
          
          // 檢查是否包含作者名稱格式 [Author Name (Year)]
          const authorMatch = originalText.match(/\[([^(]+?)\s*\([^)]+\)\]/);
          if (authorMatch) {
            const fullAuthorName = authorMatch[1].trim();
            console.log(`📝 提取的作者名: "${fullAuthorName}"`);
            
            // 嘗試多種匹配方式來找到翻譯
            let translatedAuthorName = null;
            
            // 1. 嘗試完整匹配（包含年份）
            const fullNameWithYear = originalText.match(/\[([^(]+?\([^)]+\))\]/);
            if (fullNameWithYear) {
              console.log(`🔍 完整匹配嘗試: "${fullNameWithYear[1]}"`);
              translatedAuthorName = getAuthorName(fullNameWithYear[1], language);
              console.log(`📖 完整匹配結果: "${translatedAuthorName}"`);
            }
            
            // 2. 如果沒有找到，嘗試只匹配作者名（不含年份）
            if (!translatedAuthorName || translatedAuthorName === fullNameWithYear[1]) {
              console.log(`🔍 部分匹配嘗試: "${fullAuthorName}"`);
              translatedAuthorName = getAuthorName(fullAuthorName, language);
              console.log(`📖 部分匹配結果: "${translatedAuthorName}"`);
            }
            
            if (translatedAuthorName && translatedAuthorName !== fullAuthorName) {
              // 替換作者名稱，保持年份和格式
              translatedText = originalText.replace(fullAuthorName, translatedAuthorName);
              console.log(`✅ 部分翻譯成功: "${originalText}" -> "${translatedText}"`);
            } else if (fullNameWithYear) {
              // 如果完整匹配有翻譯，使用完整匹配的翻譯
              const fullName = fullNameWithYear[1];
              const translatedFullName = getAuthorName(fullName, language);
              console.log(`🔍 嘗試完整翻譯: "${fullName}" -> "${translatedFullName}"`);
              if (translatedFullName && translatedFullName !== fullName) {
                // 替換整個完整名稱，但保持年份格式
                const yearMatch = fullName.match(/\(([^)]+)\)/);
                if (yearMatch) {
                  const year = yearMatch[1];
                  const translatedWithYear = `${translatedFullName} (${year})`;
                  translatedText = originalText.replace(fullName, translatedWithYear);
                  console.log(`✅ 完整翻譯成功: "${originalText}" -> "${translatedText}"`);
                } else {
                  translatedText = originalText.replace(fullName, translatedFullName);
                  console.log(`✅ 翻譯成功: "${originalText}" -> "${translatedText}"`);
                }
              }
            }
          } else {
            console.log(`⚠️ 註解文本不匹配作者格式: "${originalText}"`);
          }
          
          // 檢查 Railway 格式的註解 【4:7†source】
          const railwayMatch = originalText.match(/【([^】]+?)】/);
          if (railwayMatch) {
            // Railway 格式的註解不需要翻譯，直接使用
            translatedText = originalText;
          }
          
          const replacement = `${translatedText}[${citationIndex}]`;
          processedText = processedText.replace(originalText, replacement);
        }
      }
    }
    
    // 清理格式問題並改善排版
    processedText = processedText
      .replace(/【[^】]*】/g, '')
      .replace(/†[^†\s]*†?/g, '')
      .replace(/,\s*\n/g, '\n')
      .replace(/,\s*$/, '')
      .replace(/\n\s*,/g, '\n')
      .replace(/(\[\d+\])(\[\d+\])*\1+/g, '$1$2')
      .replace(/(\[\d+\])+/g, (match) => {
        const citations = match.match(/\[\d+\]/g);
        const uniqueCitations = [...new Set(citations)];
        return uniqueCitations.join('');
      })
      .replace(/(\d+)\.\s*([^：。！？\n]+[：])/g, '\n\n**$1. $2**\n')
      .replace(/([。！？])\s+(\d+\.)/g, '$1\n\n**$2')
      .replace(/([。！？])\s*([A-Za-z][^。！？]*：)/g, '$1\n\n**$2**\n')
      .replace(/\*\s*([^*\n]+)\s*：\s*\*/g, '**$1：**')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .replace(/([。！？])(?=\s*(?!\*\*\d+\.)[^\n])/g, '$1\n\n')
      .trim();
  }
  
  return { processedText, sourceMap };
}

// 創建來源列表的函數
function createSourceList(sourceMap) {
  if (sourceMap.size === 0) return '';
  
  let sourceList = '\n\n📚 **引用來源：**\n';
  
  // 按照編號順序排列
  const sortedSources = Array.from(sourceMap.entries()).sort((a, b) => a[0] - b[0]);
  
  sortedSources.forEach(([index, source]) => {
    sourceList += `**[${index}]** ${source.fileName}`;
    if (source.quote && source.quote.length > 0) {
      // 顯示引用片段（限制長度）
      const shortQuote = source.quote.length > 120 
        ? source.quote.substring(0, 120) + '...' 
        : source.quote;
      sourceList += `\n    └ *"${shortQuote}"*`;
    }
    sourceList += '\n';
  });
  
  return sourceList;
}

// 簡單的快取機制
const searchCache = new Map();

// 清空所有緩存（確保使用最新的處理邏輯）
searchCache.clear();

// 獲取快取結果
function getCachedResult(question) {
    const key = question.toLowerCase().trim();
    const cached = searchCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('✅ 使用快取結果');
        return cached.result;
    }
    return null;
}

// 設置快取結果
function setCachedResult(question, result) {
    const key = question.toLowerCase().trim();
    searchCache.set(key, {
        result: result,
        timestamp: Date.now()
    });
    console.log('💾 結果已快取');
    
    // 清理過期的快取（保持記憶體使用合理）
    if (searchCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of searchCache.entries()) {
            if (now - value.timestamp > CACHE_DURATION) {
                searchCache.delete(key);
            }
        }
    }
}

// 獲取或創建 Assistant
async function getOrCreateAssistant() {
    if (!globalAssistant) {
        console.log('🔄 創建全局 Assistant...');
        console.log(`🔧 使用模型: ${ASSISTANT_MODEL}`);
        
        // 檢查是否有向量資料庫 ID
        const vectorStoreId = process.env.VECTOR_STORE_ID;
        
        // 重試機制 - 最多重試 3 次
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (!vectorStoreId) {
                    console.log('⚠️ 未設置 VECTOR_STORE_ID，創建不帶文件搜索的 Assistant');
                    globalAssistant = await openai.beta.assistants.create({
                        model: ASSISTANT_MODEL,
                        name: 'Theology Assistant (No File Search)',
                        instructions: `你是一個專業的神學助手。
 
重要規則：
1. 回答要準確、簡潔且有幫助
2. 使用繁體中文回答
3. 專注於提供基於神學知識的準確資訊
4. 如果沒有相關資訊，請明確說明
 
格式要求：
- 直接回答問題內容
- 不需要在回答中手動添加資料來源`
                    });
                } else {
                    globalAssistant = await openai.beta.assistants.create({
                        model: ASSISTANT_MODEL,
                        name: 'Theology RAG Assistant',
                        instructions: `你是一個專業的神學助手，只能根據提供的知識庫資料來回答問題。

重要規則：
1. 只使用檢索到的資料來回答問題
2. 如果資料庫中沒有相關資訊，請明確說明「很抱歉，我在資料庫中找不到相關資訊來回答這個問題，因為資料庫都為英文，建議將專有名詞替換成英文或許會有幫助」
3. 回答要準確、簡潔且有幫助
4. 使用繁體中文回答
5. 專注於提供基於資料庫內容的準確資訊
6. 盡可能引用具體的資料片段

格式要求：
- 直接回答問題內容
- 引用相關的資料片段（如果有的話）
- 不需要在回答中手動添加資料來源，系統會自動處理`,
                        tools: [{ type: 'file_search' }],
                        tool_resources: {
                            file_search: {
                                vector_store_ids: [vectorStoreId]
                            }
                        }
                    });
                }
                
                console.log(`✅ 全局 Assistant 創建成功 (嘗試 ${attempt}/3)`);
                break; // 成功創建，跳出重試循環
                
            } catch (error) {
                console.warn(`⚠️ Assistant 創建失敗 (嘗試 ${attempt}/3):`, error.message);
                
                if (attempt === 3) {
                    // 最後一次嘗試失敗，拋出錯誤
                    console.error('❌ Assistant 創建最終失敗，將使用備用方案');
                    throw new Error(`Assistant 創建失敗: ${error.message}`);
                }
                
                // 等待後重試
                const delay = Math.min(1000 * attempt, 3000); // 指數退避，最大 3 秒
                console.log(`⏳ 等待 ${delay}ms 後重試...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // 驗證 Assistant 是否可用（額外的穩定性檢查）
    try {
        await openai.beta.assistants.retrieve(globalAssistant.id);
        return globalAssistant;
    } catch (error) {
        console.warn('⚠️ Assistant 驗證失敗，重新創建:', error.message);
        globalAssistant = null; // 重置，強制重新創建
        return await getOrCreateAssistant(); // 遞歸調用重新創建
    }
}

// OpenAI Assistant API 處理（加入 Google Sheets 紀錄）
async function processSearchRequest(question, user, language = 'zh') {
    console.log('🔄 使用 OpenAI Assistant API 方法...');
    
    const cachedResult = getCachedResult(question);
    if (cachedResult) {
        return cachedResult;
    }
    
    const requestKey = question.toLowerCase().trim();
    if (processingRequests.has(requestKey)) {
        console.log('⏳ 相同請求正在處理中，等待結果...');
        return processingRequests.get(requestKey);
    }
    
    const processingPromise = (async () => {
        try {
            const result = await processSearchRequestInternal(question, user, language);
            try {
                const userName = user?.name || '';
                const userEmail = user?.email || '';
                const timestamp = new Date().toISOString();
                const q = question;
                const a = result?.answer || '';
                await appendToGoogleSheet([timestamp, language, userName, userEmail, q, a]);
            } catch (e) {
                console.warn('⚠️ 問答寫入表單失敗（不影響回應）:', e.message);
            }
            return result;
        } finally {
            processingRequests.delete(requestKey);
        }
    })();
    
    processingRequests.set(requestKey, processingPromise);
    
    return processingPromise;
}

// 串流版本的搜索處理
async function processSearchRequestStream(question, user, language, res) {
    try {
        // 使用全局 Assistant（重用機制）
        const assistant = await getOrCreateAssistant();

        // 創建 Thread
        const thread = await openai.beta.threads.create();

        // 添加用戶問題到 Thread
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: question
        });

        // 創建串流 Run
        const stream = await openai.beta.threads.runs.stream(thread.id, {
            assistant_id: assistant.id
        });

        let fullAnswer = '';
        let sources = [];

        // 處理串流事件
        stream.on('textDelta', (textDelta) => {
            if (textDelta.value) {
                fullAnswer += textDelta.value;
                // 發送增量內容
                res.write(`data: {"type": "delta", "data": ${JSON.stringify(textDelta.value)}}\n\n`);
            }
        });

        stream.on('messageDone', async (message) => {
            // 在串流模式下，我們只收集基本的來源信息，詳細處理在 end 事件中進行
            if (message.content && message.content.length > 0) {
                const annotations = message.content[0].text?.annotations || [];
                sources = annotations.map(annotation => {
                    if (annotation.type === 'file_citation') {
                        return annotation.text || '';
                    }
                    return '';
                }).filter(Boolean);
            }
        });

        stream.on('end', async () => {
            try {
                // 重新獲取完整的消息以進行引用處理（非串流方式）
                const messages = await openai.beta.threads.messages.list(thread.id);
                const lastMessage = messages.data[0];
                
                if (lastMessage && lastMessage.role === 'assistant') {
                    const finalAnswer = lastMessage.content[0].text.value || '';
                    const annotations = lastMessage.content[0].text.annotations || [];
                    
                    // 驗證數據一致性
                    if (finalAnswer !== fullAnswer) {
                        console.warn(`⚠️ 串流與重獲取文本不一致，使用重獲取的完整文本`);
                    }
                    
                    // 處理引用
                    const { processedText, sourceMap } = await processAnnotationsInText(finalAnswer, annotations, language);
                    
                    let finalSources = Array.from(sourceMap.entries()).map(([index, source]) => ({
                        index,
                        fileName: source.fileName,
                        quote: source.quote && source.quote.length > 120 ? source.quote.substring(0, 120) + '...' : source.quote,
                        fileId: source.fileId
                    }));
                    
                    // 發送最終處理後的文本和來源
                    res.write(`data: {"type": "sources", "data": ${JSON.stringify(finalSources)}}\n\n`);
                    res.write(`data: {"type": "final", "data": ${JSON.stringify(processedText)}}\n\n`);
                } else {
                    // 如果沒有獲取到消息，使用串流的數據但也要處理引用
                    const { processedText: processedStreamText, sourceMap } = await processAnnotationsInText(fullAnswer, [], language);
                    
                    // 將sourceMap轉換為finalSources格式
                    const finalSources = Array.from(sourceMap.entries()).map(([index, source]) => ({
                        index,
                        fileName: source.fileName,
                        quote: source.quote && source.quote.length > 120 ? source.quote.substring(0, 120) + '...' : source.quote,
                        fileId: source.fileId
                    }));
                    
                    res.write(`data: {"type": "sources", "data": ${JSON.stringify(finalSources)}}\n\n`);
                    res.write(`data: {"type": "final", "data": ${JSON.stringify(processedStreamText)}}\n\n`);
                }
                
                res.write('data: {"type": "done"}\n\n');
                res.end();
                
            } catch (error) {
                console.error('❌ 串流結束處理失敗:', error.message);
                res.write(`data: {"type": "error", "error": "處理最終結果時發生錯誤"}\n\n`);
                res.end();
            }
        });

        stream.on('error', (error) => {
            console.error('❌ 串流錯誤:', error.message);
            res.write(`data: {"type": "error", "error": "串流處理錯誤"}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('❌ 串流搜索處理失敗:', error.message);
        res.write(`data: {"type": "error", "error": "搜索處理失敗"}\n\n`);
        res.end();
    }
}

// 實際的搜索處理邏輯
async function processSearchRequestInternal(question, user, language = 'zh') {
    
    try {
        // 使用全局 Assistant（重用機制）
        const assistant = await getOrCreateAssistant();
        console.log('✅ 使用現有 Assistant');

        // 創建 Thread
        const thread = await openai.beta.threads.create();
        console.log('✅ Thread 創建成功');

        // 添加用戶問題到 Thread
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: question
        });

        // 創建 Run
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id
        });
        console.log('✅ Run 創建成功，等待處理...');

        // 延遲起始輪詢 - 預估等待再查
        console.log('⏳ 預估等待 3 秒後開始檢查狀態...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 等待完成 - 超優化版等待機制
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        let attempts = 0;
        const maxAttempts = 60; // 60 秒超時
        const initialDelay = 200; // 更激進的初始延遲 200ms
        const maxDelay = 2000; // 降低最大延遲到 2 秒
        let lastStatus = runStatus.status;

        while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
            // 檢查是否需要處理工具調用
            if (runStatus.status === 'requires_action') {
                console.log('🔧 檢測到工具調用需求，立即處理...');
                
                // 處理工具調用
                const toolOutputs = [];
                for (const toolCall of runStatus.required_action.submit_tool_outputs.tool_calls) {
                    if (toolCall.function.name === 'retrieval') {
                        // 文件搜索工具調用
                        toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: "文件搜索已完成"
                        });
                    }
                }
                
                // 提交工具輸出
                runStatus = await openai.beta.threads.runs.submitToolOutputs(
                    thread.id,
                    run.id,
                    { tool_outputs: toolOutputs }
                );
                console.log('✅ 工具調用處理完成');
                attempts++;
                continue;
            }
            
            // 智能延遲策略
            let delay;
            if (attempts < 3) {
                // 前 3 次快速檢查
                delay = 200;
            } else if (attempts < 10) {
                // 中等頻率檢查
                delay = Math.min(initialDelay * Math.pow(1.1, attempts - 3), 1000);
            } else {
                // 後期較慢檢查
                delay = Math.min(initialDelay * Math.pow(1.2, attempts), maxDelay);
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            attempts++;
            
            // 智能日誌：只在狀態變化或關鍵時刻記錄
            if (runStatus.status !== lastStatus || attempts % 8 === 0 || attempts <= 3) {
                console.log(`⏳ 處理中... 嘗試次數: ${attempts}, 狀態: ${runStatus.status}`);
                lastStatus = runStatus.status;
            }
        }

        if (runStatus.status === 'failed') {
            throw new Error(`Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
        }

        if (attempts >= maxAttempts) {
            throw new Error('查詢時間過長，請嘗試簡化您的問題或稍後再試');
        }

        console.log(`📊 Run 狀態: ${runStatus.status}`);
        console.log(`🔧 Assistant ID: ${assistant.id}`);
        console.log(`💾 向量資料庫 ID: ${process.env.VECTOR_STORE_ID}`);

        // 獲取回答
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0]; // 最新的消息是 Assistant 的回答
        
        if (!lastMessage || lastMessage.role !== 'assistant') {
            throw new Error('無法獲取 Assistant 回答');
        }

        const answer = lastMessage.content[0].text.value;
        console.log('✅ 成功獲取 Assistant 回答');

        // 並行處理註解和翻譯
        const annotations = lastMessage.content[0].text.annotations;
        let { processedText, sourceMap } = await processAnnotationsInText(
            answer, 
            annotations,
            language
        );

        // 不清理 Assistant，保持重用
        console.log('✅ Assistant 重用完成');
        
        // 組合最終回答
        let finalAnswer = processedText;

        // 如果沒有獲取到回答
        if (!finalAnswer || finalAnswer.trim() === '') {
            finalAnswer = '很抱歉，我在資料庫中找不到相關資訊來回答這個問題。';
        }

        const result = {
            question: question,
            answer: finalAnswer,
            sources: Array.from(sourceMap.entries()).map(([index, source]) => ({
                index,
                fileName: source.fileName,
                quote: source.quote && source.quote.length > 120 
                    ? source.quote.substring(0, 120) + '...' 
                    : source.quote,
                fileId: source.fileId
            })),
            timestamp: new Date().toISOString(),
            user: user,
            method: 'Assistant API'
        };

        // 設置快取
        setCachedResult(question, result);

        return result;

    } catch (error) {
        console.error('❌ Assistant API 處理失敗:', error.message);
        throw error;
    }
}

// 移動設備連線檢查端點
app.get('/api/mobile-check', (req, res) => {
  res.json({
    success: true,
    message: '移動設備連線正常',
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    sessionId: req.sessionID
  });
});

// 測試搜索 API 端點 - 不需要認證（僅用於調試）
app.post('/api/test-search', async (req, res) => {
  try {
    const { question, language = 'zh' } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: '請提供有效的問題'
      });
    }

    const trimmedQuestion = question.trim();
    console.log(`收到測試搜索請求: ${trimmedQuestion} (語言: ${language})`);

    // 模擬用戶對象
    const mockUser = { email: 'test@example.com' };

    // 使用 OpenAI Assistant API
    const result = await processSearchRequest(trimmedQuestion, mockUser, language);

    console.log('測試搜索處理完成，返回結果:', JSON.stringify(result, null, 2));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('測試搜索錯誤:', error);
    
    let errorMessage = '很抱歉，處理您的問題時發生錯誤，請稍後再試。';
    
    if (error.message.includes('查詢時間過長') || error.message.includes('timeout')) {
      errorMessage = '查詢時間過長，請嘗試簡化您的問題或稍後再試。';
    } else if (error.message.includes('rate limit')) {
      errorMessage = '目前請求過多，請稍後再試。';
    } else if (error.message.includes('Assistant run failed')) {
      errorMessage = '系統處理問題，請稍後再試或聯繫管理員。';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      errorMessage = '網路連線不穩定，請檢查網路後重試。';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      retry: true
    });
  }
});



// 主要搜索 API 端點 - 串流版本
app.post('/api/search/stream', ensureAuthenticated, async (req, res) => {
  try {
    const { question, language = 'zh' } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: '請提供有效的問題'
      });
    }

    const trimmedQuestion = question.trim();
    console.log(`收到串流搜索請求: ${trimmedQuestion} (用戶: ${req.user.email}, 語言: ${language})`);

    // 懶加載預熱（在背景執行，不阻塞請求）
    if (!isWarmedUp) {
      lazyWarmup().catch(() => {}); // 靜默執行，不影響請求
    }

    // 設置 SSE 響應頭
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 發送初始連接確認
    res.write('data: {"type": "connected"}\n\n');

    // 使用串流處理
    await processSearchRequestStream(trimmedQuestion, req.user, language, res);

  } catch (error) {
    console.error('串流搜索錯誤:', error);
    
    let errorMessage = '很抱歉，處理您的問題時發生錯誤，請稍後再試。';
    
    if (error.message.includes('查詢時間過長') || error.message.includes('timeout')) {
      errorMessage = '查詢時間過長，請嘗試簡化您的問題或稍後再試。';
    } else if (error.message.includes('rate limit')) {
      errorMessage = '目前請求過多，請稍後再試。';
    } else if (error.message.includes('Assistant run failed')) {
      errorMessage = '系統處理問題，請稍後再試或聯繫管理員。';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      errorMessage = '網路連線不穩定，請檢查網路後重試。';
    }
    
    // 發送錯誤事件
    res.write(`data: {"type": "error", "error": "${errorMessage}"}\n\n`);
    res.end();
  }
});

// 主要搜索 API 端點 - 需要認證 (保持兼容)
app.post('/api/search', ensureAuthenticated, async (req, res) => {
  try {
    const { question, language = 'zh' } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: '請提供有效的問題'
      });
    }

    const trimmedQuestion = question.trim();
    console.log(`收到搜索請求: ${trimmedQuestion} (用戶: ${req.user.email}, 語言: ${language})`);

    // 懶加載預熱（在背景執行，不阻塞請求）
    if (!isWarmedUp) {
      lazyWarmup().catch(() => {}); // 靜默執行，不影響請求
    }

    // 設置響應頭，改善移動設備相容性
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 使用 OpenAI Assistant API
    const result = await processSearchRequest(trimmedQuestion, req.user, language);

    console.log('搜索處理完成，返回結果:', JSON.stringify(result, null, 2));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('搜索錯誤:', error);
    
    let errorMessage = '很抱歉，處理您的問題時發生錯誤，請稍後再試。';
    
    if (error.message.includes('查詢時間過長') || error.message.includes('timeout')) {
      errorMessage = '查詢時間過長，請嘗試簡化您的問題或稍後再試。';
    } else if (error.message.includes('rate limit')) {
      errorMessage = '目前請求過多，請稍後再試。';
    } else if (error.message.includes('Assistant run failed')) {
      errorMessage = '系統處理問題，請稍後再試或聯繫管理員。';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      errorMessage = '網路連線不穩定，請檢查網路後重試。';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      retry: true // 建議前端重試
    });
  }
});

// 幫助方法：依名稱尋找向量庫 ID（不區分大小寫）
async function findVectorStoreIdByName(name) {
  try {
    // Normalize helper
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const targetNorm = norm(name);

    // Known synonyms mapping for book names
    const synonyms = new Map([
      ['bible-songofsolomon', ['bible-songofsongs', 'bible-canticles']],
      ['bible-songofsongs', ['bible-songofsolomon', 'bible-canticles']],
    ]);

    let after = undefined;
    let bestMatch = null;
    while (true) {
      const resp = await openai.vectorStores.list({ limit: 100, after });
      // 1) exact (case-insensitive)
      const exact = resp.data.find(vs => (vs.name || '').toLowerCase() === name.toLowerCase());
      if (exact) return { id: exact.id, store: exact };

      // 2) normalized exact
      const normHit = resp.data.find(vs => norm(vs.name) === targetNorm);
      if (normHit) return { id: normHit.id, store: normHit };

      // 3) synonyms
      const synKeys = synonyms.get(targetNorm) || [];
      const synHit = resp.data.find(vs => synKeys.includes(norm(vs.name)));
      if (synHit) return { id: synHit.id, store: synHit };

      // 4) relaxed contains (prefix + book)
      const containsHit = resp.data.find(vs => norm(vs.name).includes(targetNorm));
      if (containsHit && !bestMatch) bestMatch = { id: containsHit.id, store: containsHit };

      if (!resp.has_more) break;
      after = resp.last_id;
    }
    return bestMatch; // may be null
  } catch (e) {
    console.warn('findVectorStoreIdByName error:', e.message);
    return null;
  }
}

// 特製：基於指定向量庫執行檢索（僅用於聖經解釋）
async function processBibleExplainRequest(question, targetVectorStoreId, user, language = 'zh') {
  try {
    // 建立 thread 與訊息
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: question
    });

    // 使用全局 Assistant，但在 run 時覆寫 tool_resources.vector_store_ids
    const assistant = await getOrCreateAssistant();

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      tool_resources: {
        file_search: { vector_store_ids: [targetVectorStoreId] }
      }
    });

    // 等待完成（複用現有輪詢策略的簡化版）
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    const maxAttempts = 60;
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
      if (runStatus.status === 'requires_action') {
        const toolOutputs = [];
        for (const toolCall of runStatus.required_action.submit_tool_outputs.tool_calls) {
          if (toolCall.function.name === 'retrieval') {
            toolOutputs.push({ tool_call_id: toolCall.id, output: 'ok' });
          }
        }
        runStatus = await openai.beta.threads.runs.submitToolOutputs(
          thread.id,
          run.id,
          { tool_outputs: toolOutputs }
        );
        attempts++;
        continue;
      }
      await new Promise(r => setTimeout(r, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }

    if (runStatus.status === 'failed') {
      throw new Error(runStatus.last_error?.message || 'Assistant run failed');
    }
    if (attempts >= maxAttempts) {
      throw new Error('查詢時間過長，請稍後再試');
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      throw new Error('無法獲取 Assistant 回答');
    }

    const answer = lastMessage.content[0].text.value || '';
    const annotations = lastMessage.content[0].text.annotations || [];
    const { processedText, sourceMap } = await processAnnotationsInText(answer, annotations, language);

    return {
      question,
      answer: processedText && processedText.trim() ? processedText : '很抱歉，我在資料庫中找不到相關資訊來回答這個問題。',
      sources: Array.from(sourceMap.entries()).map(([index, source]) => ({
        index,
        fileName: source.fileName,
        quote: source.quote && source.quote.length > 120 ? source.quote.substring(0, 120) + '...' : source.quote,
        fileId: source.fileId
      })),
      timestamp: new Date().toISOString(),
      user,
      method: 'Assistant API (per-book)'
    };
  } catch (e) {
    console.error('processBibleExplainRequest error:', e.message);
    throw e;
  }
}

// 串流版本的聖經經文解釋處理
async function processBibleExplainRequestStream(question, targetVectorStoreId, user, language, res, cacheKey) {
  try {
    // 建立 thread 與訊息
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: question
    });

    // 使用全局 Assistant（不覆寫 tool_resources 以確保 file_citation 正常）
    const assistant = await getOrCreateAssistant();

    // 創建串流 Run（必須覆寫 tool_resources 指定正確的書卷資料庫）
    const stream = await openai.beta.threads.runs.stream(thread.id, {
      assistant_id: assistant.id,
      tool_resources: {
        file_search: { vector_store_ids: [targetVectorStoreId] }
      }
    });

    let fullAnswer = '';
    const fileIdToQuote = new Map();

    // 處理串流事件
    stream.on('textDelta', (textDelta) => {
      if (textDelta.value) {
        fullAnswer += textDelta.value;
        // 發送增量內容
        res.write(`data: {"type": "delta", "data": ${JSON.stringify(textDelta.value)}}\n\n`);
      }
    });

    stream.on('messageDone', async (message) => {
      // 串流收集引用，但在 end 時會重新取得完整資料確保準確性
      try {
        const anns = message?.content?.[0]?.text?.annotations || [];
        for (const a of anns) {
          if (a?.type === 'file_citation') {
            const fid = a?.file_citation?.file_id || a?.file_id || '';
            if (fid && !fileIdToQuote.has(fid)) {
              fileIdToQuote.set(fid, (a?.text || a?.quote || '').toString());
            }
          }
        }
      } catch {}
    });

    stream.on('end', async () => {
      try {
        // 穩定處理：重新獲取完整訊息以確保引用完整性（參考首頁搜尋邏輯）
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0];
        
        if (lastMessage && lastMessage.role === 'assistant') {
          const finalAnswer = lastMessage.content[0].text.value || '';
          const annotations = lastMessage.content[0].text.annotations || [];
          
          // 使用穩定的引用處理邏輯（與首頁搜尋一致）
          const { processedText, sourceMap } = await processAnnotationsInText(finalAnswer, annotations, language);
          
          let finalSources = Array.from(sourceMap.entries()).map(([index, source]) => ({
            index,
            fileName: source.fileName,
            quote: source.quote && source.quote.length > 120 ? source.quote.substring(0, 120) + '...' : source.quote,
            fileId: source.fileId
          }));
          
          // 使用混合機制確保來源完整性
          const citationSources = finalSources;
          const extractedSources = extractAuthorsFromContent(finalAnswer, language);
          
          console.log(`📚 註釋來源統計 - 檔案引用: ${citationSources.length}, 內容提取: ${extractedSources.length}`);
          
          // 改進的混合邏輯：合併兩種來源以確保信息完整性
          if (extractedSources.length > 0) {
            // 如果檔案引用為空，直接使用提取的來源
            if (citationSources.length === 0) {
              finalSources = extractedSources;
              console.log(`✅ 使用內容提取的來源 (檔案引用為空)`);
            } else {
              // 合併兩種來源：檔案引用提供基礎信息，內容提取提供書名詳情
              const mergedSources = [];
              
              // 首先添加檔案引用來源
              citationSources.forEach(source => {
                mergedSources.push(source);
              });
              
              // 然後添加內容提取的來源（包含書名）
              extractedSources.forEach(extractedSource => {
                // 檢查是否已有相似的作者
                const isDuplicate = mergedSources.some(existing => {
                  const existingName = existing.fileName.toLowerCase();
                  const extractedName = extractedSource.fileName.toLowerCase();
                  return existingName.includes(extractedName.split(' - ')[0].toLowerCase()) ||
                         extractedName.includes(existingName.toLowerCase());
                });
                
                if (!isDuplicate) {
                  mergedSources.push({
                    ...extractedSource,
                    index: mergedSources.length + 1
                  });
                }
              });
              
              finalSources = mergedSources;
              console.log(`✅ 合併來源完成 - 最終數量: ${finalSources.length}`);
            }
          } else if (citationSources.length === 0) {
            // 兩種來源都為空的情況
            finalSources = [];
            console.log(`⚠️ 無可用來源`);
          } else {
            // 只有檔案引用的情況
            finalSources = citationSources;
            console.log(`✅ 使用檔案引用來源`);
          }
          
          // 發送來源後再發送文本
          res.write(`data: {"type": "sources", "data": ${JSON.stringify(finalSources)}}\n\n`);
          res.write(`data: {"type": "final", "data": ${JSON.stringify(processedText)}}\n\n`);
          
        } else {
          // 如果沒有獲取到訊息，使用串流收集的資料但也要處理引用
          const finalSources = [];
          const entries = Array.from(fileIdToQuote.entries());
          for (let i = 0; i < entries.length; i++) {
            const [fid, quote] = entries[i];
            try {
              const f = await openai.files.retrieve(fid);
              finalSources.push({ index: i + 1, fileName: cleanFileName(f?.filename || ''), quote: quote && quote.length > 120 ? quote.substring(0,120)+'...' : quote, fileId: fid });
            } catch {
              finalSources.push({ index: i + 1, fileName: '', quote, fileId: fid });
            }
          }
          
          // 對fullAnswer也進行引用處理
          const { processedText: processedFullAnswer, sourceMap } = await processAnnotationsInText(fullAnswer, [], language);
          
          res.write(`data: {"type": "sources", "data": ${JSON.stringify(finalSources)}}\n\n`);
          res.write(`data: {"type": "final", "data": ${JSON.stringify(processedFullAnswer)}}\n\n`);
        }
        
        // 發送完成信號
        res.write('data: {"type": "done"}\n\n');
        res.end();

      } catch (error) {
        console.error('串流完成處理錯誤:', error);
        res.write(`data: {"type": "error", "error": "處理完成時發生錯誤"}\n\n`);
        res.end();
      }
    });

    stream.on('error', (error) => {
      console.error('聖經解釋串流錯誤:', error);
      res.write(`data: {"type": "error", "error": "串流處理發生錯誤"}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('串流聖經解釋處理錯誤:', error);
    res.write(`data: {"type": "error", "error": "解釋處理發生錯誤"}\n\n`);
    res.end();
    throw error;
  }
}

// 聖經經文解釋 - 串流版本
app.post('/api/bible/explain/stream', ensureAuthenticated, async (req, res) => {
  try {
    const { bookEn, ref, translation, language = 'zh', passageText } = req.body || {};

    if (!bookEn || !ref) {
      return res.status(400).json({ success: false, error: '缺少必要參數 bookEn 或 ref' });
    }

    const storePrefix = process.env.BIBLE_STORE_PREFIX || 'Bible-';
    const targetName = `${storePrefix}${bookEn}`;
    const storeResult = await getVectorStoreIdCachedByName(targetName);
    if (!storeResult) {
      return res.status(503).json({ success: false, error: `該卷資料庫尚未建立完成，請稍後再試（${targetName}）` });
    }
    
    // 檢查是否為空白store
    const fileCount = storeResult.store?.file_counts?.total || 0;
    if (fileCount === 0) {
      return res.status(503).json({ 
        success: false, 
        error: `${bookEn}卷的註釋資料庫目前暫無內容，我們正在努力補充中，請選擇其他經卷或稍後再試。` 
      });
    }
    
    const vsId = storeResult.id;

    // 設置 SSE 響應頭
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 發送初始連接確認
    res.write('data: {"type": "connected"}\n\n');

    const zhPrompt = `請嚴格僅根據資料庫內容作答。針對「${bookEn} ${ref}」，請專門搜尋「${bookEn}」書卷相關的註釋資料，「全面檢索所有涉及此段經文的作者」，不可省略任何作者，逐一輸出。

【重要】請確保引用資料來源並產生完整的 file_citation 標註。每段引用的資料都必須包含檔案引用標記。

輸出格式（嚴格遵守）：
- 第一行（標題）：**作者名稱（年代）**
- 緊接下一行：該作者的完整敘述性解釋（不可條列、不可編號）
- 每位作者之間以一個空行分隔
- 不要在文末輸出任何「資料來源」清單（來源由系統處理）

其他要求：
- 只根據「${bookEn}」相關的向量庫內容作答；若無資料，請明確輸出「找不到相關資料」。
- 作者名稱請以原文輸出，系統將負責依介面語言轉換。
- 確保所有引用都附帶完整的檔案引用標註。

以下為選取經文僅用於定位語境（不可作為回答來源）：
${passageText ? '---\n' + passageText + '\n---' : ''}`;

    const enPrompt = `Answer strictly from the provided vector store only. For "${bookEn} ${ref}", specifically search for "${bookEn}" book commentary data, perform an exhaustive retrieval of ALL authors in this book who comment on the passage (do not omit any author) and output each one.

【IMPORTANT】Please ensure you cite sources and generate complete file_citation annotations. Every cited piece of data must include file reference markers.

Output format (follow exactly):
- First line (title): **Author Name (Years)**
- Next line: one complete narrative paragraph for this author's interpretation (no lists, no numbering)
- Separate each author by one blank line
- Do NOT output any sources list at the end (sources will be handled by the system)

Other rules:
- Answer only from "${bookEn}" related vector store content; if nothing is found, say so explicitly.
- Keep author names in original language; the system will localize them.
- Ensure all quotes include complete file citation annotations.

Passage is provided only to locate context (do not use it as a source of facts):
${passageText ? '---\n' + passageText + '\n---' : ''}`;

    const q = (language === 'en' ? enPrompt : zhPrompt) + (translation ? `\n（版本：${translation}）` : '');

    const cacheKey = `${targetName}|${ref}|${translation || ''}|${language}|${passageText ? 'withPassage' : ''}`.toLowerCase();
    // 不使用快取：每次重新生成

    // 使用串流處理
    await processBibleExplainRequestStream(q, vsId, req.user, language, res, cacheKey);

  } catch (error) {
    console.error('串流聖經經文解釋錯誤:', error.message);
    res.write(`data: {"type": "error", "error": "處理失敗，請稍後再試"}\n\n`);
    res.end();
  }
});

// 聖經經文解釋（依卷限定向量庫）- 保持兼容
app.post('/api/bible/explain', ensureAuthenticated, async (req, res) => {
  try {
    const { bookEn, ref, translation, language = 'zh', passageText } = req.body || {};

    if (!bookEn || !ref) {
      return res.status(400).json({ success: false, error: '缺少必要參數 bookEn 或 ref' });
    }

    const storePrefix = process.env.BIBLE_STORE_PREFIX || 'Bible-';
    const targetName = `${storePrefix}${bookEn}`;
    const storeResult = await getVectorStoreIdCachedByName(targetName);
    if (!storeResult) {
      return res.status(503).json({ success: false, error: `該卷資料庫尚未建立完成，請稍後再試（${targetName}）` });
    }
    
    // 檢查是否為空白store
    const fileCount = storeResult.store?.file_counts?.total || 0;
    if (fileCount === 0) {
      return res.status(503).json({ 
        success: false, 
        error: `${bookEn}卷的註釋資料庫目前暫無內容，我們正在努力補充中，請選擇其他經卷或稍後再試。` 
      });
    }
    
    const vsId = storeResult.id;

    // 讓回答格式列出「每位作者」對指定經文的解釋，並附註來源（交由檔案引用處理）。
    // 傳入的 passageText 僅作為定位語境，仍然必須只根據資料庫內容回答。
    const zhPrompt = `請嚴格僅根據資料庫內容作答。針對「${ref}」，請在本卷向量庫中「全面檢索所有涉及此段經文的作者」，不要省略任何一位作者。必須展示該經卷資料庫中所有對此段經文有註釋的作者資料。

對每位作者，請按以下格式呈現：
1. 標題部分：**作者名稱（年代，著作名稱）** - 作者名稱、年代和著作名稱必須加粗顯示
2. 內文部分：用一段完整的敘述方式詳盡說明這位神學家對這段經文的解釋和觀點，包含其詮釋角度、論據、神學立場等，不得使用條列式或數字清單

要求：
- 標題部分格式：作者名稱（年代和著作名稱）須加粗
- 內文必須是敘述性段落，不可用條列
- 必須包含資料庫中所有對此經文有註釋的作者
- 著作名稱請保持原文

若無資料，請直接說明找不到相關資料。

以下為選取經文僅用於定位語境（不可作為回答來源）：
${passageText ? '---\n' + passageText + '\n---' : ''}`;

    const enPrompt = `Answer strictly from the provided vector store only. For "${ref}", perform an exhaustive retrieval of ALL authors in this book who comment on the passage (do not omit any author). Must display all author data from this book's database that have commentary on this passage.

For each author, please present in the following format:
1. Title section: **Author Name (Year, Work Title)** - Author name, year, and work title must be in bold
2. Content section: Provide one complete narrative paragraph explaining this theologian's interpretation of this passage, including their interpretive approach, arguments, theological position, etc. No bullet points or numbered lists.

Requirements:
- Title format: Author name (year and work title) must be bold
- Content must be narrative paragraphs, not lists
- Must include ALL authors from the database who comment on this passage
- Keep work titles in original language

If nothing is found, state it directly.

Passage provided only to locate context (do not use it as a source of facts):
${passageText ? '---\n' + passageText + '\n---' : ''}`;

    const q = (language === 'en' ? enPrompt : zhPrompt) + (translation ? `\n（版本：${translation}）` : '');

    const cacheKey = `${targetName}|${ref}|${translation || ''}|${language}|${passageText ? 'withPassage' : ''}`.toLowerCase();
    const cached = getBibleExplainCached(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    const result = await processBibleExplainRequest(q, vsId, req.user, language);
    setBibleExplainCached(cacheKey, result);

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('聖經經文解釋錯誤:', error.message);
    res.status(500).json({ success: false, error: '處理失敗，請稍後再試' });
  }
});

// 作者對照表 API（必須在靜態文件服務之前）
app.get('/config/author-translations.json', (req, res) => {
  try {
    const translationsPath = path.join(__dirname, 'config', 'author-translations.json');
    if (fs.existsSync(translationsPath)) {
      const data = fs.readFileSync(translationsPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.send(data);
    } else {
      res.status(404).json({ success: false, error: '作者對照表不存在' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: '無法讀取作者對照表' });
  }
});

// 作品目錄 API
app.get('/api/catalog', (req, res) => {
  try {
    const catalog = fs.readFileSync(path.join(__dirname, 'public', 'ccel_catalog.json'), 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(catalog);
  } catch (err) {
    res.status(500).json({ success: false, error: '無法讀取作品目錄' });
  }
});

// 聖經文本 API
app.get('/api/bible-text/:version', (req, res) => {
  try {
    const version = req.params.version.toLowerCase();
    let filename;
    
    switch (version) {
      case 'kjv':
        filename = 'kjv-bible.txt';
        break;
      case 'cuv':
        filename = 'cuv-bible.txt';
        break;
      case 'unv':
        filename = 'unv-bible.txt';
        break;
      default:
        return res.status(400).json({ error: 'Unsupported Bible version' });
    }
    
    const filePath = path.join(__dirname, 'data', 'bible-versions', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Bible text file not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    console.error('讀取聖經文本失敗:', err);
    res.status(500).json({ error: 'Failed to read Bible text' });
  }
});

// 新增：FHL 聖經 JSON 代理端點（qb.php）
app.get('/api/bible/qb', async (req, res) => {
  try {
    const upstreamBase = 'https://bible.fhl.net/json/qb.php';

    // 保留所有查詢參數並轉發
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }

    // 若無參考字串，回覆錯誤
    if (!params.has('chineses') && !params.has('engs')) {
      return res.status(400).json({ success: false, error: '缺少經文參考（chineses 或 engs）' });
    }

    // 給定預設版本（和合本）
    if (!params.has('version')) {
      params.set('version', 'unv');
    }

    // 預設限制避免過大回應
    if (!params.has('limit')) {
      params.set('limit', '200');
    }

    const upstreamUrl = `${upstreamBase}?${params.toString()}`;

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, error: '上游服務錯誤', details: text.slice(0, 500) });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (err) {
    console.error('FHL 代理錯誤:', err);
    res.status(500).json({ success: false, error: 'FHL 代理請求失敗' });
  }
});

// 新增：bolls.life 聖經章節代理端點
app.get('/api/bible/chapter', async (req, res) => {
  try {
    const translation = (req.query.translation || 'CUV').toString().toUpperCase();
    const bookId = parseInt(req.query.bookId, 10);
    const chapter = parseInt(req.query.chapter, 10);
    if (!bookId || !chapter) {
      return res.status(400).json({ success: false, error: '缺少必要參數 bookId 或 chapter' });
    }

    const upstreamUrl = `https://bolls.life/get-text/${encodeURIComponent(translation)}/${bookId}/${chapter}/`;
    const response = await fetch(upstreamUrl, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, error: '上游服務錯誤', details: text.slice(0, 500) });
    }
    const data = await response.json();
    // 期待 data 為 verses 陣列
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (err) {
    console.error('bolls 代理錯誤:', err);
    res.status(500).json({ success: false, error: 'bolls 代理請求失敗' });
  }
});

// 健康檢查端點
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      vectorStore: !!process.env.VECTOR_STORE_ID,
      googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      mongodb: !!process.env.MONGO_URI,
      session: !!process.env.SESSION_SECRET
    }
  };
  
  // 檢查關鍵服務是否可用
  const criticalServices = ['openai', 'vectorStore', 'session'];
  const missingServices = criticalServices.filter(service => !healthStatus.services[service]);
  
  if (missingServices.length > 0) {
    healthStatus.status = 'warning';
    healthStatus.warnings = `缺少關鍵服務: ${missingServices.join(', ')}`;
  }
  
  res.json(healthStatus);
});

// 獲取系統資訊端點
app.get('/api/info', (req, res) => {
  res.json({
    name: '神學知識庫 API',
    version: '1.0.0',
    description: '基於 OpenAI 向量搜索的神學問答系統',
    vectorStoreId: VECTOR_STORE_ID ? 'configured' : 'not configured',
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    method: 'OpenAI Assistant API'
  });
});

// Robots.txt and sitemap.xml
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.send(`User-agent: *\nAllow: /\n\nSitemap: ${base.replace(/\/$/, '')}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const baseUrl = base.replace(/\/$/, '');
  const currentDate = new Date().toISOString().split('T')[0];
  
  // 聖經書卷列表
  const bibleBooks = [
    // 舊約
    'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth',
    '1samuel', '2samuel', '1kings', '2kings', '1chronicles', '2chronicles', 'ezra', 'nehemiah',
    'esther', 'job', 'psalms', 'proverbs', 'ecclesiastes', 'songofsolomon', 'isaiah', 'jeremiah',
    'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah',
    'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi',
    // 新約
    'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1corinthians', '2corinthians',
    'galatians', 'ephesians', 'philippians', 'colossians', '1thessalonians', '2thessalonians',
    '1timothy', '2timothy', 'titus', 'philemon', 'hebrews', 'james', '1peter', '2peter',
    '1john', '2john', '3john', 'jude', 'revelation'
  ];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
  <!-- 首頁 -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- 主要功能頁面 -->
  <url>
    <loc>${baseUrl}/bible</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/search</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/commentary</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  // 添加聖經書卷
  bibleBooks.forEach(book => {
    const priority = ['psalms', 'proverbs', 'matthew', 'mark', 'luke', 'john', 'romans', 'revelation'].includes(book) ? '0.8' : '0.7';
    xml += `
  
  <url>
    <loc>${baseUrl}/bible/${book}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  xml += `

</urlset>`;
  
  res.send(xml);
});

// Serve index.html with dynamic canonical, OG url, GA4 and GSC meta
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(filePath, 'utf8');
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    if (base) {
      html = html.replace(/https:\/\/your-domain\.example/g, base.replace(/\/$/, ''));
    }
    // Inject GSC verification if present
    if (process.env.GOOGLE_SITE_VERIFICATION) {
      html = html.replace('</head>', `  <meta name="google-site-verification" content="${process.env.GOOGLE_SITE_VERIFICATION}">\n</head>`);
    }
    // 動態替換 GA 設定
    const isProduction = process.env.NODE_ENV === 'production';
    const gaMeasurementId = isProduction 
      ? process.env.GA_MEASUREMENT_ID_PROD || process.env.GA_MEASUREMENT_ID || 'G-TMB36DPDSV'
      : process.env.GA_MEASUREMENT_ID_DEV || process.env.GA_MEASUREMENT_ID || 'G-QF244M02C5';
    
    const gaEnvironment = isProduction ? 'production' : 'development';
    
    // 替換 HTML 中的 GA 設定
    html = html.replace(/G-QF244M02C5/g, gaMeasurementId);
    html = html.replace(/window\.GA_ENVIRONMENT = 'development'/g, `window.GA_ENVIRONMENT = '${gaEnvironment}'`);
    
    console.log(`📊 GA4 動態設定 (${gaEnvironment}環境): ${gaMeasurementId}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    res.sendFile(filePath);
  }
});

// 服務靜態文件
app.use(express.static(path.join(__dirname, 'public')));

// 錯誤處理中間件
app.use((error, req, res, next) => {
  console.error('未處理的錯誤:', error);
  res.status(500).json({
    success: false,
    error: '服務器內部錯誤',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 聖經預熱API（需要在404處理器之前）
app.post('/api/bible/warmup', ensureAuthenticated, async (req, res) => {
  try {
    const { bookEn } = req.body || {};

    if (!bookEn) {
      return res.status(400).json({ success: false, error: '缺少必要參數 bookEn' });
    }

    const storePrefix = process.env.BIBLE_STORE_PREFIX || 'Bible-';
    const targetName = `${storePrefix}${bookEn}`;
    
    // 檢查向量資料庫是否存在
    const storeResult = await getVectorStoreIdCachedByName(targetName);
    if (!storeResult) {
      return res.json({ 
        success: false, 
        message: `${bookEn} 資料庫尚未建立`,
        cached: false 
      });
    }
    
    // 檢查是否為空白store
    const fileCount = storeResult.store?.file_counts?.total || 0;
    if (fileCount === 0) {
      return res.json({ 
        success: false, 
        message: `${bookEn} 資料庫目前暫無內容`,
        cached: false 
      });
    }

    const vsId = storeResult.id;

    console.log(`🔥 開始預熱 ${bookEn} 資料庫 (${vsId})...`);

    // 執行預熱：發送一個簡單的測試查詢
    const assistant = await getOrCreateAssistant();
    const thread = await openai.beta.threads.create();
    
    // 使用簡單的預熱查詢
    const warmupQuery = `Test query for ${bookEn} database warmup`;
    
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: warmupQuery
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      tool_resources: {
        file_search: { vector_store_ids: [vsId] }
      }
    });

    // 不等待完成，只是觸發預熱
    console.log(`✅ ${bookEn} 資料庫預熱已觸發`);
    
    res.json({
      success: true,
      message: `${bookEn} 資料庫預熱完成`,
      cached: true,
      fileCount: fileCount
    });

  } catch (error) {
    console.error('預熱資料庫錯誤:', error);
    res.status(500).json({
      success: false,
      error: '預熱失敗'
    });
  }
});

// 初始化筆記資料庫
// 筆記資料庫初始化 - 優先使用 PostgreSQL，備用 SQLite
let notesDB = null;
let usingPostgreSQL = false;

async function initNotesDatabase() {
  try {
    // 檢查是否有 PostgreSQL 環境變數
    if (process.env.DATABASE_URL) {
      console.log('🔄 嘗試連接 PostgreSQL...');
      try {
        const pgDB = await initPostgreSQLDatabase();
        if (pgDB) {
          notesDB = pgDB;
          usingPostgreSQL = true;
          console.log('✅ 使用 PostgreSQL 筆記資料庫');
          return;
        }
      } catch (pgError) {
        console.warn('⚠️  PostgreSQL 初始化失敗，退回 SQLite:', pgError.message);
      }
    } else {
      console.log('⚠️  未找到 DATABASE_URL，跳過 PostgreSQL');
    }
    
    // 備用：使用 SQLite
    console.log('🔄 使用 SQLite 作為備用資料庫...');
    if (initDatabase()) {
      notesDB = new NotesDB();
      usingPostgreSQL = false;
      console.log('✅ 使用 SQLite 筆記資料庫（備用）');
      console.log('⚠️  注意：SQLite 資料在部署時會丟失，建議設置 PostgreSQL');
    }
  } catch (error) {
    console.error('❌ 筆記資料庫初始化失敗:', error);
    notesDB = null;
  }
}

// 立即初始化資料庫
initNotesDatabase();

// 筆記 API 中間件：檢查資料庫是否可用
function ensureNotesDBAvailable(req, res, next) {
  if (!notesDB) {
    return res.status(503).json({ 
      success: false, 
      error: '筆記功能暫時無法使用，正在初始化資料庫' 
    });
  }
  next();
}

// ==================== 筆記 API 端點 ====================

// 建立新筆記
app.post('/api/notes', ensureAuthenticated, ensureNotesDBAvailable, async (req, res) => {
  try {
    const {
      title,
      content,
      bibleBook,
      bibleBookZh,
      bibleChapter,
      bibleVerseStart,
      bibleVerseEnd,
      bibleVersion,
      bibleText,
      tags,
      category,
      color,
      isPublic
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '標題和內容為必填項目'
      });
    }

    const noteData = {
      userId: req.user.id,
      title: title.trim(),
      content: content.trim(),
      bibleBook,
      bibleBookZh,
      bibleChapter: bibleChapter ? parseInt(bibleChapter) : null,
      bibleVerseStart: bibleVerseStart ? parseInt(bibleVerseStart) : null,
      bibleVerseEnd: bibleVerseEnd ? parseInt(bibleVerseEnd) : null,
      bibleVersion: bibleVersion || 'CUV',
      bibleText,
      tags: Array.isArray(tags) ? tags : [],
      category: category || 'default',
      color: color || 'blue',
      isPublic: Boolean(isPublic)
    };

    const result = usingPostgreSQL ? 
      await notesDB.createNote(noteData) : 
      notesDB.createNote(noteData);
    
    if (result.success) {
      res.json({
        success: true,
        data: { id: result.id },
        message: '筆記建立成功'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '建立筆記失敗'
      });
    }
  } catch (error) {
    console.error('建立筆記 API 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '伺服器錯誤'
    });
  }
});

// 獲取用戶所有筆記
app.get('/api/notes', ensureAuthenticated, ensureNotesDBAvailable, async (req, res) => {
  try {
    const { category, search, book, chapter } = req.query;
    let notes;

    if (search) {
      notes = usingPostgreSQL ? 
        await notesDB.searchNotes(req.user.id, search) :
        notesDB.searchNotes(req.user.id, search);
    } else if (category) {
      notes = usingPostgreSQL ? 
        await notesDB.getNotesByCategory(req.user.id, category) :
        notesDB.getNotesByCategory(req.user.id, category);
    } else if (book && chapter) {
      notes = usingPostgreSQL ? 
        await notesDB.getNotesByBibleRef(req.user.id, book, parseInt(chapter)) :
        notesDB.getNotesByBibleRef(req.user.id, book, parseInt(chapter));
    } else {
      notes = usingPostgreSQL ? 
        await notesDB.getUserNotes(req.user.id) :
        notesDB.getUserNotes(req.user.id);
    }

    res.json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('獲取筆記 API 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取筆記失敗'
    });
  }
});

// 獲取用戶筆記統計
app.get('/api/notes/stats', ensureAuthenticated, ensureNotesDBAvailable, async (req, res) => {
  try {
    const stats = usingPostgreSQL ? 
      await notesDB.getUserStats(req.user.id) :
      notesDB.getUserStats(req.user.id);
    const tags = usingPostgreSQL ? 
      await notesDB.getUserTags(req.user.id) :
      notesDB.getUserTags(req.user.id);

    res.json({
      success: true,
      data: {
        ...stats,
        tags
      }
    });
  } catch (error) {
    console.error('獲取統計 API 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取統計失敗'
    });
  }
});

// 獲取特定筆記
app.get('/api/notes/:id', ensureAuthenticated, ensureNotesDBAvailable, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const note = usingPostgreSQL ? 
      await notesDB.getNoteById(noteId, req.user.id) :
      notesDB.getNoteById(noteId, req.user.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: '筆記不存在'
      });
    }

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('獲取筆記 API 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取筆記失敗'
    });
  }
});

// 更新筆記
app.put('/api/notes/:id', ensureAuthenticated, ensureNotesDBAvailable, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const { title, content, tags, category, color, isPublic } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '標題和內容為必填項目'
      });
    }

    const updateData = {
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags : [],
      category: category || 'default',
      color: color || 'blue',
      isPublic: Boolean(isPublic)
    };

    const result = usingPostgreSQL ? 
      await notesDB.updateNote(noteId, req.user.id, updateData) :
      notesDB.updateNote(noteId, req.user.id, updateData);

    if (result.success) {
      res.json({
        success: true,
        message: '筆記更新成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '筆記不存在或更新失敗'
      });
    }
  } catch (error) {
    console.error('更新筆記 API 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '更新筆記失敗'
    });
  }
});

// 刪除筆記
app.delete('/api/notes/:id', ensureAuthenticated, ensureNotesDBAvailable, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const result = usingPostgreSQL ? 
      await notesDB.deleteNote(noteId, req.user.id) :
      notesDB.deleteNote(noteId, req.user.id);

    if (result.success) {
      res.json({
        success: true,
        message: '筆記刪除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '筆記不存在或刪除失敗'
      });
    }
  } catch (error) {
    console.error('刪除筆記 API 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '刪除筆記失敗'
    });
  }
});



// ==================== 筆記 API 端點結束 ====================

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '找不到請求的資源'
  });
});

// 全局錯誤處理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// 優雅關閉處理
process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信號，開始優雅關閉...');
  stopPeriodicWarmup();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到 SIGINT 信號，開始優雅關閉...');
  stopPeriodicWarmup();
  process.exit(0);
});

// OpenAI 建議的指數退避重試機制
async function warmupWithBackoff(fn, maxRetries = 3) {
    const delays = [1000, 3000, 5000]; // OpenAI 建議的延遲間隔
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`❌ 預熱失敗 [${i + 1}/${maxRetries}]:`, error.message);
            
            if (i === maxRetries - 1) {
                console.log('💡 已達最大重試次數，跳過預熱');
                throw error;
            }
            
            const delay = delays[i];
            console.log(`⏳ 等待 ${delay}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// 使用 Responses API 進行輕量化預熱（推薦方案）
async function performLightweightWarmup() {
    console.log('🔥 開始輕量化預熱 - 使用 Responses API...');
    console.log(`🔧 預熱模型: ${ASSISTANT_MODEL}`);
    
    const startTime = Date.now();
    
    try {
        const response = await warmupWithBackoff(async () => {
            return await openai.responses.create({
                model: ASSISTANT_MODEL,
                input: "ping"
            });
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ 輕量化預熱完成 - 耗時 ${duration}ms`);
        console.log(`📊 Response ID: ${response.id}`);
        console.log('🎯 模型已在伺服器端熱身，後續查詢將更穩定');
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.warn(`⚠️ Responses API 預熱失敗 (耗時 ${duration}ms):`, error.message);
        console.log('🔄 嘗試使用 Chat Completions API 備用預熱...');
        
        // 備用方案：使用 Chat Completions API + 更穩定的模型
        try {
            const fallbackModel = ASSISTANT_MODEL === 'gpt-4o-mini' ? 'gpt-4o' : ASSISTANT_MODEL;
            console.log(`🔧 備用預熱模型: ${fallbackModel}`);
            
            const chatResponse = await openai.chat.completions.create({
                model: fallbackModel,
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 1,
                temperature: 0
            });
            
            const totalDuration = Date.now() - startTime;
            console.log(`✅ 備用預熱完成 - 總耗時 ${totalDuration}ms`);
            console.log(`📊 Chat Response ID: ${chatResponse.id}`);
            
        } catch (fallbackError) {
            const totalDuration = Date.now() - startTime;
            console.warn(`⚠️ 備用預熱也失敗 (總耗時 ${totalDuration}ms):`, fallbackError.message);
            console.log('💡 系統仍可正常運行，首次查詢可能稍慢');
            throw fallbackError;
        }
    }
}

// 懶加載預熱：在第一次用戶請求時執行
async function lazyWarmup() {
    if (isWarmedUp) return;
    
    console.log('🔥 執行懶加載預熱（首次用戶請求觸發）...');
    
    try {
        const response = await openai.responses.create({
            model: ASSISTANT_MODEL,
            input: "ping"
        });
        
        isWarmedUp = true;
        console.log(`✅ 懶加載預熱成功 - Response ID: ${response.id}`);
        console.log('🎯 後續查詢將更快速');
        
    } catch (error) {
        console.log('💡 懶加載預熱失敗，不影響當前請求:', error.message);
        // 不設定 isWarmedUp = true，讓下次請求再試
    }
}

// 穩健的 Assistant 預熱（使用更穩定的策略）
async function performAssistantWarmup() {
    try {
        console.log('🔥 開始 Assistant 預熱...');
        console.log('💡 建議：先執行 Responses API 預熱，可大幅提升 Assistant 穩定性');
        
        // 獲取或創建 Assistant
        const assistant = await getOrCreateAssistant();
        
        await warmupWithBackoff(async () => {
            // 創建 Thread
            const thread = await openai.beta.threads.create();
            
            // 發送極簡測試問題
            await openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: "test"
            });
            
            // 創建並等待 Run 完成（縮短等待時間）
            const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
                assistant_id: assistant.id
            }, {
                pollIntervalMs: 1000,
                maxWaitSeconds: 10  // 縮短到10秒
            });
            
            if (run.status !== 'completed') {
                throw new Error(`Run failed with status: ${run.status}, error: ${run.last_error?.message || 'unknown'}`);
            }
            
            return run;
        });
        
        console.log('✅ Assistant 預熱完成 - 系統已完全準備就緒');
        
    } catch (error) {
        console.warn('⚠️ Assistant 預熱失敗:', error.message);
        console.log('💡 這通常是因為 gpt-4o-mini 在 Assistants API 的動態資源分配問題');
        console.log('💡 建議使用 gpt-4o 或在 Railway 設定 ASSISTANT_MODEL=gpt-4o');
    }
}

// 定期保溫機制
function startPeriodicWarmup() {
    // 每 10 分鐘執行一次保溫
    const WARMUP_INTERVAL = 10 * 60 * 1000; // 10 分鐘
    
    assistantWarmupInterval = setInterval(async () => {
        try {
            console.log('🔥 執行定期保溫...');
            
            // 簡單的 ping 操作
            const assistant = await getOrCreateAssistant();
            await openai.beta.assistants.retrieve(assistant.id);
            
            console.log('✅ 定期保溫完成');
        } catch (error) {
            console.warn('⚠️ 定期保溫失敗:', error.message);
        }
    }, WARMUP_INTERVAL);
    
    console.log(`🔄 定期保溫已啟動 (每 ${WARMUP_INTERVAL / 60000} 分鐘)`);
}

// 停止定期保溫
function stopPeriodicWarmup() {
    if (assistantWarmupInterval) {
        clearInterval(assistantWarmupInterval);
        assistantWarmupInterval = null;
        console.log('🛑 定期保溫已停止');
    }
}

async function appendToGoogleSheet(rowValues) {
  try {
    const { GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
    if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      console.warn('⚠️ Google Sheets 環境變數未完整，略過寫入');
      return;
    }
    const jwt = new google.auth.JWT(
      GOOGLE_CLIENT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    );
    await jwt.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwt });
    const now = new Date();
    const values = [rowValues];
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'A:Z',
      valueInputOption: 'RAW',
      requestBody: { values }
    });
    console.log('✅ 已寫入 Google Sheet');
  } catch (err) {
    console.error('❌ 寫入 Google Sheet 失敗:', err.message);
  }
}



// 啟動服務器
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 神學知識庫服務器已啟動`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🔍 API 健康檢查: /api/health`);
  console.log(`📊 系統狀態: /api/info`);
  console.log(`💡 向量資料庫 ID: ${VECTOR_STORE_ID ? '已設定' : '未設定'}`);
  console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '已設定' : '未設定'}`);
  console.log(`🤖 使用 OpenAI Assistant API 模式`);
  
  // 載入作者對照表
  await loadAuthorTranslations();
  
  // 改進的啟動策略 - 預設啟用預熱
  setTimeout(async () => {
    try {
      // 啟動定期保溫機制
      console.log('🔄 啟動 Assistant 保溫機制...');
      startPeriodicWarmup();
      console.log('✅ Assistant 保溫機制已啟動');
      
      // 寬容的預熱策略（預設啟用但容錯性高）
      if (process.env.DISABLE_WARMUP !== 'true') {
        console.log('🔥 開始系統預熱...');
        setTimeout(async () => {
          // 網路連接診斷
          console.log('🌐 檢查網路連接狀況...');
          console.log(`🔗 API Key 狀態: ${process.env.OPENAI_API_KEY ? '已設定' : '未設定'}`);
          console.log(`🚀 運行環境: ${process.env.NODE_ENV || 'development'}`);
          
          try {
            // 第一階段：輕量化預熱（容錯處理）
            await performLightweightWarmup();
            console.log('🎉 預熱成功！後續 API 調用將更快速');
            
          } catch (error) {
            console.log('💡 預熱失敗，分析可能原因：');
            
            if (error.message.includes('Connection error')) {
              console.log('   • 網路連接問題（Railway 環境網路限制？）');
              console.log('   • OpenAI API 服務暫時不可用');
              console.log('   • 防火牆或代理設定問題');
            } else if (error.message.includes('API key')) {
              console.log('   • API Key 未設定或無效');
            } else {
              console.log('   • 其他 OpenAI API 問題');
            }
            
            console.log('💡 系統仍可正常運行，首次查詢時會自動初始化');
          }
          
          // 第二階段：可選的 Assistant 預熱（僅在明確要求時執行）
          if (process.env.ENABLE_ASSISTANT_WARMUP === 'true') {
            console.log('🔥 環境變數啟用 Assistant 預熱...');
            setTimeout(async () => {
              try {
                await performAssistantWarmup();
              } catch (error) {
                console.log('💡 Assistant 預熱失敗，但不影響系統運行');
              }
            }, 3000); // 延遲3秒，給網路更多時間
          }
          
        }, 3000); // 延遲3秒執行，確保系統完全穩定
      } else {
        console.log('💡 預熱功能已停用 (DISABLE_WARMUP=true)');
      }
      
    } catch (error) {
      console.warn('⚠️ 啟動系統失敗:', error.message);
      console.log('💡 系統將以最小配置運行');
    }
  }, 1000); // 1秒後開始，確保系統完全初始化
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log(`⚠️  注意: Google OAuth 未配置，登入功能將不可用`);
    console.log(`   請設置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 環境變數`);
  }
  
  if (!process.env.VECTOR_STORE_ID) {
    console.log(`⚠️  注意: VECTOR_STORE_ID 未配置，向量搜索功能將不可用`);
    console.log(`   請設置 VECTOR_STORE_ID 環境變數`);
  }
});

// 向量庫狀態查詢（僅供驗證 Bible-* 是否建立完成）
app.get('/api/bible/vector-status', ensureAuthenticated, async (req, res) => {
  try {
    const prefix = (process.env.BIBLE_STORE_PREFIX || 'Bible-').toLowerCase();
    let after;
    const stores = [];
    while (true) {
      const r = await openai.vectorStores.list({ limit: 100, after });
      for (const vs of r.data) {
        const name = (vs.name || '').toLowerCase();
        if (name.startsWith(prefix)) {
          stores.push({ id: vs.id, name: vs.name });
        }
      }
      if (!r.has_more) break;
      after = r.last_id;
    }
    res.json({ success: true, count: stores.length, stores });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/login', (req, res) => {
  res.redirect('/');
});


