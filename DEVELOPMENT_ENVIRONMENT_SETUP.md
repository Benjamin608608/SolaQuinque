# 開發環境設置指南

## 🎯 目標
建立獨立的開發環境，避免開發測試影響正式環境的使用者。

## 🚀 推薦方案：Railway 獨立開發環境

### 步驟 1：創建新的 Railway 服務

1. **登入 Railway Dashboard**
   - 前往 [Railway.app](https://railway.app)
   - 登入您的帳戶

2. **創建新專案**
   - 點擊 "New Project"
   - 選擇 "Deploy from GitHub repo"
   - 選擇您的 `Theologian2-6` 倉庫
   - 命名為 `Theologian-Dev` 或 `Theologian-Staging`

3. **設置自動部署分支**
   - 在專案設置中選擇 `development` 分支
   - 或創建新的 `staging` 分支

### 步驟 2：環境變數配置

在新的 Railway 服務中設置以下環境變數：

```bash
# 基本配置
NODE_ENV=development
PORT=$PORT

# OpenAI API（可以使用相同的 API Key）
OPENAI_API_KEY=your_openai_api_key_here

# 開發環境專用向量庫（建議使用不同的）
VECTOR_STORE_ID=vs_dev_your_dev_vector_store_id

# Google OAuth（需要設置開發環境專用的）
GOOGLE_CLIENT_ID=your_dev_google_client_id
GOOGLE_CLIENT_SECRET=your_dev_google_client_secret
GOOGLE_CALLBACK_URL=https://your-dev-app-name.railway.app/auth/google/callback

# Session 配置
SESSION_SECRET=your_dev_session_secret

# 開發環境 SEO 設置
PUBLIC_BASE_URL=https://your-dev-app-name.railway.app
GOOGLE_SITE_VERIFICATION=dev_verification_token
GA_MEASUREMENT_ID=G-DEV-TRACKING-ID

# 開發環境 Google Sheets（可選）
GOOGLE_SHEETS_SPREADSHEET_ID=dev_spreadsheet_id
GOOGLE_CLIENT_EMAIL=dev-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nDEV_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

### 步驟 3：Google OAuth 開發環境設置

1. **在 Google Cloud Console 中**
   - 前往現有專案或創建新專案
   - 創建新的 OAuth 憑證或編輯現有憑證
   - 添加開發環境回調 URL：
     ```
     https://your-dev-app-name.railway.app/auth/google/callback
     ```

2. **測試域名設置**
   - 確保開發環境域名與 OAuth 設置匹配

### 步驟 4：資料隔離策略

#### 選項 A：完全獨立資料（推薦）
```bash
# 使用不同的向量庫 ID
VECTOR_STORE_ID=vs_dev_independent_store

# 使用不同的 MongoDB 資料庫
MONGODB_URI=mongodb://dev-database-url
```

#### 選項 B：共享資料但分離測試
```bash
# 使用相同向量庫但添加開發標記
VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23
DEV_MODE=true

# 在代碼中添加開發模式邏輯
```

## 🔧 本地開發環境

### 創建開發環境配置文件

創建 `.env.development` 文件：

```bash
# 複製 .env.example 並修改
cp env.example .env.development

# 設置開發專用配置
NODE_ENV=development
PORT=3001
PUBLIC_BASE_URL=http://localhost:3001
```

### 開發腳本

在 `package.json` 中添加開發專用腳本：

```json
{
  "scripts": {
    "dev:staging": "NODE_ENV=development nodemon server.js",
    "dev:production-test": "NODE_ENV=production nodemon server.js",
    "deploy:dev": "railway deploy --service dev-service",
    "deploy:prod": "railway deploy --service prod-service"
  }
}
```

## 📊 開發流程建議

### Git 分支策略

```bash
# 主要分支
main          # 正式環境
development   # 開發環境
staging       # 預發布環境（可選）

# 功能分支
feature/optimization-tests
feature/new-features
bugfix/critical-fixes
```

### 部署流程

1. **本地開發**
   ```bash
   git checkout development
   npm run dev:staging
   ```

2. **推送到開發環境**
   ```bash
   git push origin development
   # Railway 自動部署到開發環境
   ```

3. **測試通過後合併到主分支**
   ```bash
   git checkout main
   git merge development
   git push origin main
   # Railway 自動部署到正式環境
   ```

## 🔍 監控和測試

### 環境健康檢查

創建環境特定的健康檢查：

```bash
# 開發環境
GET https://your-dev-app.railway.app/api/health

# 正式環境  
GET https://your-prod-app.railway.app/api/health
```

### 性能對比測試

可以在開發環境中：
- 測試不同的向量搜索參數
- 測試新的 UI 組件
- 進行負載測試
- 測試新的 AI 模型設置

## ⚠️ 注意事項

1. **API 配額管理**
   - OpenAI API 配額會在兩個環境間共享
   - 考慮使用較小的測試資料集

2. **成本控制**
   - Railway 按使用量計費
   - 開發環境可以設置較低的資源限制

3. **資料同步**
   - 定期從正式環境同步必要的測試資料
   - 避免在開發環境中使用敏感的正式用戶資料

4. **環境標識**
   - 在開發環境 UI 中添加明顯的標識
   - 避免混淆不同環境

## 🚀 快速開始

運行以下腳本快速設置開發環境：

```bash
# 設置開發分支
npm run setup:dev-branch

# 部署到開發環境
npm run deploy:dev

# 驗證開發環境
npm run verify:dev
```
