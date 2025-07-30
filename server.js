const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 讓 express-session 支援 proxy (如 Railway/Heroku/Render)
app.set('trust proxy', 1);

// 初始化 OpenAI 客戶端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      useUnifiedTopology: true,
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

// Session 配置（secure: true，適用於 https 雲端平台）
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Railway/Render/Heroku 上必須 true
    maxAge: 24 * 60 * 60 * 1000 // 24 小時
  }
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
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// 認證路由 - 僅在 Google OAuth 已配置時啟用
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
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
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    });
  } else {
    res.json({
      success: false,
      user: null
    });
  }
});

// 獲取文件名稱的函數
async function getFileName(fileId) {
  try {
    const file = await openai.files.retrieve(fileId);
    let fileName = file.filename || `檔案-${fileId.substring(0, 8)}`;
    fileName = fileName.replace(/\.(txt|pdf|docx?|rtf|md)$/i, '');
    return fileName;
  } catch (error) {
    console.warn(`無法獲取檔案名稱 ${fileId}:`, error.message);
    return `檔案-${fileId.substring(0, 8)}`;
  }
}

// 處理引用標記並轉換為網頁格式的函數
async function processAnnotationsInText(text, annotations) {
  let processedText = text;
  const sourceMap = new Map();
  const usedSources = new Map();
  let citationCounter = 1;
  
  if (annotations && annotations.length > 0) {
    for (const annotation of annotations) {
      if (annotation.type === 'file_citation' && annotation.file_citation) {
        const fileId = annotation.file_citation.file_id;
        const fileName = await getFileName(fileId);
        const quote = annotation.file_citation.quote || '';
        
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
          const replacement = `${originalText}[${citationIndex}]`;
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

// 全局 Assistant 實例
let globalAssistant = null;

// 簡單的快取機制
const searchCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30分鐘快取

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
        globalAssistant = await openai.beta.assistants.create({
            model: 'gpt-4o-mini',
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
                    vector_store_ids: [process.env.VECTOR_STORE_ID]
                }
            }
        });
        console.log('✅ 全局 Assistant 創建成功');
    }
    return globalAssistant;
}

// OpenAI Assistant API 處理
async function processSearchRequest(question, user) {
    console.log('🔄 使用 OpenAI Assistant API 方法...');
    
    // 檢查快取
    const cachedResult = getCachedResult(question);
    if (cachedResult) {
        return cachedResult;
    }
    
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

        // 等待完成 - 改良版等待機制
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        let attempts = 0;
        const maxAttempts = 60; // 增加到 60 秒

        while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            attempts++;
            
            console.log(`⏳ 處理中... 嘗試次數: ${attempts}, 狀態: ${runStatus.status}`);
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

        // 處理註解並轉換為引用格式
        const { processedText, sourceMap } = await processAnnotationsInText(
            answer, 
            lastMessage.content[0].text.annotations
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

// 主要搜索 API 端點 - 需要認證
app.post('/api/search', ensureAuthenticated, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: '請提供有效的問題'
      });
    }

    const trimmedQuestion = question.trim();
    console.log(`收到搜索請求: ${trimmedQuestion} (用戶: ${req.user.email})`);

    // 使用 OpenAI Assistant API
    const result = await processSearchRequest(trimmedQuestion, req.user);

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
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// 服務靜態文件（前端）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 錯誤處理中間件
app.use((error, req, res, next) => {
  console.error('未處理的錯誤:', error);
  res.status(500).json({
    success: false,
    error: '服務器內部錯誤',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

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

// 啟動服務器
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 神學知識庫服務器已啟動`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🔍 API 健康檢查: /api/health`);
  console.log(`📊 系統狀態: /api/info`);
  console.log(`💡 向量資料庫 ID: ${VECTOR_STORE_ID ? '已設定' : '未設定'}`);
  console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '已設定' : '未設定'}`);
  console.log(`🤖 使用 OpenAI Assistant API 模式`);
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log(`⚠️  注意: Google OAuth 未配置，登入功能將不可用`);
    console.log(`   請設置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 環境變數`);
  }
  
  if (!process.env.VECTOR_STORE_ID) {
    console.log(`⚠️  注意: VECTOR_STORE_ID 未配置，向量搜索功能將不可用`);
    console.log(`   請設置 VECTOR_STORE_ID 環境變數`);
  }
});
