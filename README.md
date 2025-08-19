# 神學知識庫 (Theology Knowledge Base)

> 探索歷代神學家的智慧結晶，為您的信仰尋找堅實的根基。

[![部署狀態](https://img.shields.io/badge/部署-Railway-brightgreen)](https://theologian2-production.up.railway.app)
[![版本](https://img.shields.io/badge/版本-1.0.0-blue)](https://github.com/Benjamin608608/Theologian2)
[![授權](https://img.shields.io/badge/授權-MIT-yellow)](LICENSE)

## 🌟 專案簡介

神學知識庫是一個結合人工智能技術的專業神學研究平台，提供智能聖經查詢、經文解釋、神學資料搜尋等服務。支援中英文雙語，適合牧者、神學生及信徒使用。

### 🎯 核心特色

- **🤖 AI 驅動**：基於 OpenAI GPT 模型的智能神學問答
- **📖 聖經研究**：多版本聖經對照、章節導航、經文解釋
- **📚 豐富資源**：整合歷代神學家著作與註釋文獻
- **🌍 雙語支援**：中文繁體與英文完整支援
- **🔐 安全登入**：Google OAuth 身份驗證
- **📱 響應式設計**：完美適配桌面與行動裝置

---

## 🚀 線上體驗

**正式網站**：https://theologian2-production.up.railway.app

### 快速開始
1. 使用 Google 帳戶登入
2. 在首頁搜尋欄輸入神學問題或聖經經文
3. 探索 AI 生成的深度解答與引用資料
4. 瀏覽聖經章節並獲得註釋解釋

---

## 📋 功能詳細介紹

### 🏠 首頁搜尋
- **智能問答**：支援自然語言神學問題查詢
- **即時串流**：逐字顯示 AI 回應，提升使用體驗
- **引用系統**：自動標註資料來源，包含作者翻譯
- **多語言**：中英文問題都能獲得對應語言回答

### 📖 聖經查詢
- **多版本支援**：
  - 中文：和合本 (CUV)
  - 英文：英王欽定本 (KJV)
- **智能導航**：
  - 舊約新約分類瀏覽
  - 快速章節跳轉
  - 書卷搜尋功能
- **版本對照**：同時顯示不同譯本
- **章節預載**：智能預載前後章節，提升瀏覽速度

### 💭 經文註釋
- **AI 解經**：基於神學文獻的深度經文解釋
- **多元觀點**：整合不同神學家的見解
- **引用豐富**：包含書名、作者、年代等完整資訊
- **上下文分析**：考慮經文歷史背景與神學意義

### 📚 參考書目
- **作者搜尋**：快速查找特定神學家著作
- **著作瀏覽**：按分類瀏覽神學文獻
- **智能推薦**：根據查詢內容推薦相關資料

---

## 🛠️ 技術架構

### 前端技術
- **HTML5 + CSS3**：語義化標籤與現代 CSS
- **Vanilla JavaScript**：原生 JS，無框架依賴
- **Tailwind CSS**：實用優先的 CSS 框架
- **響應式設計**：完美支援各種螢幕尺寸

### 後端技術
- **Node.js + Express.js**：高效能伺服器框架
- **OpenAI API**：GPT 模型與向量搜尋
- **MongoDB Atlas**：雲端資料庫，儲存使用者資料
- **Passport.js**：Google OAuth 身份驗證

### 核心功能實現

#### 🤖 AI 搜尋系統
```javascript
// 使用 OpenAI Assistant API 進行智能搜尋
const assistant = await openai.beta.assistants.create({
  model: "gpt-4o",
  tools: [{"type": "file_search"}],
  tool_resources: {
    "file_search": {
      "vector_store_ids": [vectorStoreId]
    }
  }
});
```

#### 📊 速率限制
```javascript
// 防止 API 濫用的多層保護
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 分鐘
  max: 20,                  // 最多 20 次搜尋
  message: "搜尋請求過於頻繁，請稍後再試"
});
```

#### 💾 智能快取
```javascript
// 聖經章節預載系統
window.ChapterPreloader = {
  cache: new Map(),
  preloadRange: 2,          // 預載前後 2 章
  maxCacheSize: 20,         // 最多快取 20 章
  // ... 快取管理邏輯
};
```

### 資料來源
- **聖經文本**：和合本、英王欽定本
- **神學文獻**：歷代神學家著作與註釋
- **向量資料庫**：OpenAI 向量搜尋，支援語義查詢

---

## 🔧 本地開發

### 環境需求
- Node.js 16.0.0+
- npm 或 yarn
- MongoDB 資料庫
- OpenAI API 金鑰
- Google OAuth 憑證

### 安裝步驟

1. **複製專案**
```bash
git clone https://github.com/Benjamin608608/Theologian2.git
cd Theologian2
```

2. **安裝依賴**
```bash
npm install
```

3. **環境變數設定**
```bash
cp env.example .env
```

編輯 `.env` 檔案：
```env
# OpenAI 設定
OPENAI_API_KEY=your_openai_api_key
VECTOR_STORE_ID=your_vector_store_id
OPENAI_ASSISTANT_MODEL=gpt-4o-mini

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# 資料庫
MONGO_URI=your_mongodb_connection_string

# 應用程式設定
SESSION_SECRET=your_session_secret
PORT=3000
NODE_ENV=development
```

4. **啟動開發伺服器**
```bash
npm run dev
```

5. **開啟瀏覽器**
```
http://localhost:3000
```

### 專案結構
```
Theologian2/
├── public/                 # 前端靜態檔案
│   ├── index.html         # 主頁面
│   ├── privacy.html       # 隱私權政策
│   ├── terms.html         # 使用條款
│   ├── ccel_catalog.json  # 參考書目資料
│   └── robots.txt         # SEO 設定
├── config/                # 設定檔案
│   └── author-translations.json  # 作者翻譯對照
├── scripts/               # 部署腳本
│   └── verify-deployment.js      # 部署驗證
├── server.js              # 主伺服器檔案
├── package.json           # 專案依賴
├── railway.toml           # Railway 部署設定
└── README.md              # 專案說明
```

---

## 🚀 部署指南

### Railway 部署 (推薦)

1. **連接 GitHub**
   - 在 [Railway](https://railway.app) 建立新專案
   - 連接您的 GitHub 儲存庫

2. **環境變數設定**
   - 在 Railway 儀表板設定所有必要的環境變數
   - 確保 `GOOGLE_CALLBACK_URL` 指向正確的域名

3. **自動部署**
   - Railway 會自動偵測 `railway.toml` 設定
   - 每次推送到 `main` 分支會自動觸發部署

### 其他平台部署

專案也支援其他 Node.js 託管平台：
- Heroku
- Vercel
- DigitalOcean App Platform
- AWS Elastic Beanstalk

---

## 🔐 安全與隱私

### 資料保護
- **OAuth 認證**：使用 Google 官方認證，不儲存密碼
- **HTTPS 加密**：所有通訊都經過 SSL/TLS 加密
- **速率限制**：防止 API 濫用和 DDoS 攻擊
- **資料最小化**：僅收集必要的使用者資訊

### 隱私政策
- 詳細的隱私權政策：[/privacy.html](https://theologian2-production.up.railway.app/privacy.html)
- 使用條款：[/terms.html](https://theologian2-production.up.railway.app/terms.html)
- 符合 GDPR 和相關法規要求

### API 安全
```javascript
// 多層速率限制
app.use('/api/search', searchLimiter);      // 搜尋限制
app.use('/api/bible-explain', bibleLimiter); // 註釋限制
app.use('/auth', authLimiter);               // 認證限制
```

---

## 📊 效能優化

### 前端優化
- **DOM 快取**：減少重複查詢，提升操作速度
- **章節預載**：智能預載相鄰章節
- **圖片懶載入**：按需載入圖片資源
- **網路監控**：偵測連線狀態，提供離線提示

### 後端優化
- **搜尋快取**：快取熱門查詢結果
- **連接池**：最佳化資料庫連接
- **串流回應**：即時回傳 AI 生成內容
- **錯誤重試**：自動重試失敗的 API 請求

### 監控指標
```javascript
// 效能監控
window.PerformanceMonitor = {
  timers: new Map(),
  start(name) { /* 計時開始 */ },
  end(name) { /* 計時結束並記錄 */ }
};
```

---

## 🌐 SEO 與可見度

### 搜尋引擎最佳化
- **Sitemap**：完整的網站地圖 (`/sitemap.xml`)
- **Meta 標籤**：豐富的 SEO 標籤設定
- **結構化資料**：Schema.org 標記
- **語義化 HTML**：正確的標題階層結構

### 社群媒體
- **Open Graph**：Facebook、LinkedIn 分享最佳化
- **Twitter Cards**：Twitter 分享卡片
- **多語言標籤**：`hreflang` 標記支援

---

## 🤝 貢獻指南

### 如何參與
1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 開發規範
- **代碼風格**：遵循 ESLint 規範
- **提交訊息**：使用語義化提交格式
- **測試覆蓋**：新功能需包含相應測試
- **文件更新**：重要變更需更新文件

### 報告問題
- 使用 [GitHub Issues](https://github.com/Benjamin608608/Theologian2/issues)
- 提供詳細的錯誤描述和重現步驟
- 包含瀏覽器、作業系統等環境資訊

---

## 📞 聯絡資訊

- **Email**：theologian.knowledge@gmail.com
- **網站**：https://theologian2-production.up.railway.app
- **GitHub**：https://github.com/Benjamin608608/Theologian2

---

## 📄 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

---

## 🙏 致謝

感謝以下技術和服務提供商：
- **OpenAI**：提供強大的 AI 模型支援
- **Railway**：優秀的部署平台
- **MongoDB Atlas**：可靠的雲端資料庫
- **Google**：OAuth 認證服務
- **所有神學家與學者**：提供寶貴的神學文獻資源

---

## 📈 更新日誌

### v1.0.0 (2025-01-13)
- ✨ 首次正式發佈
- 🤖 完整的 AI 搜尋功能
- 📖 聖經查詢與註釋系統
- 🔐 Google OAuth 登入
- 🌍 中英文雙語支援
- 📱 響應式設計
- 🛡️ 完整的安全與隱私保護

---

## 🔮 未來規劃

- [ ] 更多聖經版本支援
- [ ] 離線模式
- [ ] 個人筆記功能
- [ ] 社群討論區
- [ ] 進階搜尋篩選
- [ ] API 開放計畫

---

<div align="center">

**神學知識庫** - 為信仰研究而生的智能平台

Made with ❤️ by [Benjamin608608](https://github.com/Benjamin608608)

</div>