const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const VectorService = require('./services/vectorService');

const app = express();
const PORT = process.env.PORT || 3000;

// 讓 express-session 支援 proxy (如 Railway/Heroku/Render)
app.set('trust proxy', 1);

// 初始化向量服務
const vectorService = new VectorService();
let vectorServiceInitialized = false;

// 初始化向量服務
async function initializeVectorService() {
  try {
    console.log('🚀 正在初始化 FAISS 向量服務...');
    await vectorService.initialize();
    vectorServiceInitialized = true;
    console.log('✅ FAISS 向量服務初始化完成');
  } catch (error) {
    console.error('❌ FAISS 向量服務初始化失敗:', error);
    console.log('💡 將使用傳統的 OpenAI Assistant 模式');
  }
}

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
  if (sourceMap.size === 0) return [];
  
  const sortedSources = Array.from(sourceMap.entries()).sort((a, b) => a[0] - b[0]);
  
  return sortedSources.map(([index, source]) => ({
    index,
    fileName: source.fileName,
    quote: source.quote && source.quote.length > 120 
      ? source.quote.substring(0, 120) + '...' 
      : source.quote,
    fileId: source.fileId
  }));
}

// FAISS 向量搜索處理
async function processSearchRequestWithFAISS(question, user) {
    console.log('🔄 使用 FAISS 混合搜索方法...');
    
    try {
        // 使用混合搜索策略
        const result = await vectorService.hybridSearch(question, 15);
        
        console.log('✅ 混合搜索完成');
        console.log(`📊 使用了 ${result.vectorResults} 個向量搜索結果`);
        
        return {
            question: question,
            answer: result.answer,
            sources: result.sources.map((source, index) => ({
                index: index + 1,
                fileName: source.fileName,
                quote: source.text,
                similarity: source.similarity
            })),
            timestamp: new Date().toISOString(),
            user: user,
            method: result.method
        };
        
    } catch (error) {
        console.error('❌ FAISS 混合搜索失敗:', error.message);
        console.log('🔄 回退到傳統 Assistant API 方法...');
        
        // 回退到傳統方法
        return await processSearchRequest(question, user);
    }
}

// 傳統 OpenAI Assistant API 處理
async function processSearchRequest(question, user) {
    console.log('🔄 使用傳統 OpenAI Assistant API 方法...');
    
    try {
        // 創建或獲取 Assistant
        let assistant;
        try {
            assistant = await openai.beta.assistants.retrieve(process.env.VECTOR_STORE_ID);
            console.log('✅ 成功獲取現有 Assistant');
        } catch (error) {
            console.log('🔄 創建新的 Assistant...');
            assistant = await openai.beta.assistants.create({
                name: "神學知識庫助手",
                instructions: `你是一位專業的神學知識庫助手，專門回答關於基督教神學的問題。

你的任務：
1. 基於提供的知識庫資料回答問題
2. 提供準確、詳細且學術性的回答
3. 使用繁體中文回答
4. 保持傳統中文的表達方式
5. 引用相關的來源和作者
6. 如果資料不足，請明確說明

回答要求：
- 準確性：確保回答基於可靠的資料
- 完整性：提供全面的解釋
- 學術性：保持專業的學術水準
- 可讀性：使用清晰的語言表達

請確保每個回答都符合這些標準。`,
                model: "gpt-4o-mini",
                tools: [{"type": "file_search"}],
                tool_resources: {
                    file_search: {
                        vector_store_ids: [process.env.VECTOR_STORE_ID]
                    }
                }
            });
            console.log('✅ 新 Assistant 創建成功');
        }

        // 創建 Thread
        const thread = await openai.beta.threads.create();
        console.log('✅ Thread 創建成功');

        // 添加用戶問題到 Thread
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: question
        });

        // 創建 Run
        const run = await openai.beta.assistants.runs.create(thread.id, {
            assistant_id: assistant.id
        });
        console.log('✅ Run 創建成功，等待處理...');

        // 等待 Run 完成
        let runStatus = await openai.beta.assistants.runs.retrieve(thread.id, run.id);
        let attempts = 0;
        const maxAttempts = 30; // 最多等待 30 次

        while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
            if (attempts >= maxAttempts) {
                throw new Error('處理超時，請稍後再試');
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待 2 秒
            runStatus = await openai.beta.assistants.runs.retrieve(thread.id, run.id);
            attempts++;
            
            console.log(`⏳ 處理中... 嘗試次數: ${attempts}, 狀態: ${runStatus.status}`);
        }

        if (runStatus.status === 'failed') {
            throw new Error('Assistant 處理失敗');
        }

        // 獲取回答
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0]; // 最新的消息是 Assistant 的回答
        
        if (!lastMessage || lastMessage.role !== 'assistant') {
            throw new Error('無法獲取 Assistant 回答');
        }

        const answer = lastMessage.content[0].text.value;
        console.log('✅ 成功獲取 Assistant 回答');

        // 獲取來源資訊
        const sources = [];
        if (lastMessage.content[0].text.annotations) {
            lastMessage.content[0].text.annotations.forEach((annotation, index) => {
                if (annotation.type === 'file_citation') {
                    sources.push({
                        index: index + 1,
                        fileName: annotation.text,
                        quote: annotation.text,
                        fileId: annotation.file_citation.file_id
                    });
                }
            });
        }

        return {
            question: question,
            answer: answer,
            sources: sources,
            timestamp: new Date().toISOString(),
            user: user,
            method: 'Assistant API'
        };

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

    // 優先使用 FAISS 向量搜索，如果失敗則回退到傳統方法
    let result;
    if (vectorServiceInitialized) {
      try {
        console.log('🚀 使用 FAISS 向量搜索...');
        result = await processSearchRequestWithFAISS(trimmedQuestion, req.user);
        console.log('✅ FAISS 搜索完成');
      } catch (faissError) {
        console.error('FAISS 搜索失敗，回退到傳統方法:', faissError);
        console.log('🔄 使用傳統 OpenAI Assistant 方法...');
        result = await processSearchRequest(trimmedQuestion, req.user);
      }
    } else {
      console.log('🔄 FAISS 未初始化，使用傳統 OpenAI Assistant 方法...');
      result = await processSearchRequest(trimmedQuestion, req.user);
    }

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
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
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
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log(`⚠️  注意: Google OAuth 未配置，登入功能將不可用`);
    console.log(`   請設置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 環境變數`);
  }
  
  // 在 Railway 環境中自動初始化向量服務
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Railway 生產環境 - 正在初始化 FAISS 向量服務...');
    try {
      await initializeVectorService();
      console.log('✅ FAISS 向量服務初始化完成，系統已準備就緒！');
    } catch (error) {
      console.error('❌ FAISS 向量服務初始化失敗:', error);
      console.log('💡 系統將使用傳統的 OpenAI Assistant 模式');
    }
  } else {
    console.log('💡 開發環境 - 向量服務將在需要時初始化');
  }
});
