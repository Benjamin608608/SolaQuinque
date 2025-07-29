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

// 使用 FAISS 向量搜索的快速搜索函數
async function processSearchRequestWithFAISS(question, user = null) {
  console.log(`🚀 使用 FAISS 向量搜索處理請求: ${question}${user ? ` (用戶: ${user.email})` : ''}`);
  
  try {
    // 使用 FAISS 進行向量搜索
    const searchResults = await vectorService.search(question, 5);
    console.log(`✅ 找到 ${searchResults.length} 個相關文本片段`);
    
    // 構建上下文
    const context = searchResults.map((result, index) => 
      `[${index + 1}] ${result.text}`
    ).join('\n\n');
    
    // 使用 GPT 生成回答
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `你是一個專業的神學助手，只能根據提供的知識庫資料來回答問題。

重要規則：
1. 只使用檢索到的資料來回答問題
2. 如果資料庫中沒有相關資訊，請明確說明「很抱歉，我在資料庫中找不到相關資訊來回答這個問題」
3. 回答要準確、簡潔且有幫助
4. 使用繁體中文回答
5. 專注於提供基於資料庫內容的準確資訊
6. 在回答中引用相關的資料片段，格式為 [1], [2], [3] 等

格式要求：
- 直接回答問題內容
- 引用相關的資料片段（使用 [1], [2], [3] 格式）
- 如果沒有相關資料，請明確說明`
        },
        {
          role: 'user',
          content: `問題：${question}\n\n相關資料：\n${context}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const botAnswer = completion.choices[0].message.content;
    
    // 構建來源列表
    const sources = searchResults.map((result, index) => ({
      fileName: `神學知識庫片段 ${index + 1}`,
      content: result.text.substring(0, 200) + '...',
      score: result.score
    }));
    
    return {
      question: question,
      answer: botAnswer,
      sources: sources,
      timestamp: new Date().toISOString(),
      user: user ? { email: user.email, name: user.name } : null,
      method: 'FAISS'
    };
    
  } catch (error) {
    console.error('FAISS 搜索失敗:', error);
    throw error;
  }
}

// 傳統的 OpenAI Assistant 搜索函數（作為備用）
async function processSearchRequest(question, user = null) {
  console.log(`處理搜索請求: ${question}${user ? ` (用戶: ${user.email})` : ''}`);
  console.log('創建 OpenAI Assistant...');
  
  const assistant = await openai.beta.assistants.create({
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
        vector_store_ids: [VECTOR_STORE_ID]
      }
    }
  });

  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: question
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id
  });
  console.log('Assistant run 已創建，等待完成...');

  // 等待完成
  let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  console.log('初始 run 狀態:', runStatus.status);
  let attempts = 0;
  const maxAttempts = 60;

  while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    attempts++;
    if (attempts % 10 === 0) {
      console.log(`等待中... 嘗試次數: ${attempts}, 狀態: ${runStatus.status}`);
    }
  }

  if (runStatus.status === 'failed') {
    throw new Error(`Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
  }

  if (attempts >= maxAttempts) {
    throw new Error('查詢時間過長，請嘗試簡化您的問題或稍後再試');
  }

  // 獲取回答
  const threadMessages = await openai.beta.threads.messages.list(thread.id);
  const responseMessage = threadMessages.data[0];
  
  let botAnswer = '';
  let sources = [];
  
  if (responseMessage.content && responseMessage.content.length > 0) {
    const textContent = responseMessage.content.find(content => content.type === 'text');
    if (textContent) {
      const { processedText, sourceMap } = await processAnnotationsInText(
        textContent.text.value, 
        textContent.text.annotations
      );
      
      botAnswer = processedText;
      sources = createSourceList(sourceMap);
    }
  }

  if (!botAnswer) {
    botAnswer = '很抱歉，我在資料庫中找不到相關資訊來回答這個問題。\n\n📚 **資料來源：** 神學知識庫';
  }

  // 清理資源
  try {
    await openai.beta.assistants.del(assistant.id);
  } catch (cleanupError) {
    console.warn('Failed to cleanup assistant:', cleanupError.message);
  }

  return {
    question: question,
    answer: botAnswer,
    sources: sources,
    timestamp: new Date().toISOString(),
    user: user ? { email: user.email, name: user.name } : null,
    method: 'Assistant'
  };
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
  
  // 初始化向量服務
  try {
    await initializeVectorService();
  } catch (error) {
    console.error('❌ 向量服務初始化失敗:', error);
    console.log('💡 系統將使用傳統的 OpenAI Assistant 模式');
  }
});
