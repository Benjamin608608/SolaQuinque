# Railway 部署指南

## 環境變數配置

在 Railway 儀表板中，您需要設置以下環境變數：

### 必需環境變數

```bash
# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key_here

# 向量資料庫 ID
VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23

# Session 配置
SESSION_SECRET=your_session_secret_here

# 環境配置
NODE_ENV=production
PORT=$PORT
```

### 可選環境變數（用於 Google OAuth 登入）

```bash
# Google OAuth 配置
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback

# MongoDB 配置（如果使用）
MONGO_URI=your_mongodb_connection_string
```

## 部署步驟

1. **連接 GitHub 倉庫**
   - 在 Railway 儀表板中連接您的 GitHub 倉庫

2. **設置環境變數**
   - 在 Railway 專案設定中添加上述環境變數
   - 確保 `OPENAI_API_KEY` 和 `SESSION_SECRET` 已正確設置

3. **部署應用程式**
   - Railway 會自動檢測 `package.json` 並使用 `npm start` 啟動應用程式

4. **檢查部署狀態**
   - 訪問 `/api/health` 端點檢查應用程式狀態
   - 查看 Railway 日誌以排查任何錯誤

## 故障排除

### 常見問題

1. **"Not Found" 錯誤**
   - 檢查環境變數是否正確設置
   - 確認 `OPENAI_API_KEY` 有效
   - 查看 Railway 日誌中的錯誤訊息

2. **應用程式無法啟動**
   - 確認 `package.json` 中的 `start` 腳本正確
   - 檢查 Node.js 版本（需要 >= 16.0.0）

3. **API 端點無回應**
   - 檢查 `/api/health` 端點是否正常
   - 確認靜態文件路徑正確

### 健康檢查端點

- **健康檢查**: `https://your-app.railway.app/api/health`
- **系統資訊**: `https://your-app.railway.app/api/info`

## 本地開發

```bash
# 安裝依賴
npm install

# 設置環境變數
cp env.example .env
# 編輯 .env 文件並填入正確的值

# 啟動開發服務器
npm run dev
```

## 注意事項

- 確保您的 OpenAI API 金鑰有足夠的額度
- Google OAuth 回調 URL 必須使用 HTTPS
- 在生產環境中，所有敏感資訊都應通過環境變數設置 