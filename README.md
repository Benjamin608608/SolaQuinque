# 神學知識庫

基於 OpenAI 向量搜索的神學問答系統，提供中文神學文獻的智能搜索和問答功能。

## 🚀 快速部署

### Railway 部署

1. **Fork 或 Clone 此倉庫**
2. **在 Railway 中連接 GitHub 倉庫**
3. **設置環境變數**（在 Railway 儀表板中）：

```bash
# 必需環境變數
OPENAI_API_KEY=your_openai_api_key_here
VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23
SESSION_SECRET=your_session_secret_here
NODE_ENV=production

# 可選環境變數（用於 Google OAuth）
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback
MONGO_URI=your_mongodb_connection_string
```

4. **部署完成後，訪問您的 Railway URL**

### 本地開發

```bash
# 安裝依賴
npm install

# 設置環境變數
cp env.example .env
# 編輯 .env 文件

# 檢查環境變數
npm run check-env

# 啟動開發服務器
npm run dev
```

## 🔧 故障排除

### Railway "Not Found" 錯誤

如果遇到 Railway 的 "Not Found" 錯誤，請檢查：

1. **環境變數設置**
   ```bash
   npm run check-env
   ```

2. **健康檢查端點**
   - 訪問 `https://your-app.railway.app/api/health`
   - 查看 Railway 日誌

3. **常見問題**
   - 確保 `OPENAI_API_KEY` 有效且有足夠額度
   - 檢查 `VECTOR_STORE_ID` 是否正確
   - 確認 `SESSION_SECRET` 已設置

### 有用的端點

- **健康檢查**: `/api/health`
- **系統資訊**: `/api/info`
- **作品目錄**: `/api/catalog`

## 📚 功能特色

- 🔍 **智能搜索**: 基於 OpenAI 向量搜索的神學文獻搜索
- 💬 **智能問答**: 基於神學文獻的 AI 問答系統
- 🔐 **Google 登入**: 可選的 Google OAuth 認證
- 📊 **使用統計**: MongoDB 記錄用戶登入和使用情況
- 📱 **響應式設計**: 支援桌面和移動設備

## 🛠️ 技術棧

- **後端**: Node.js, Express.js
- **AI**: OpenAI API, Vector Search
- **資料庫**: MongoDB Atlas
- **認證**: Passport.js, Google OAuth
- **部署**: Railway

## 📖 詳細文檔

更多詳細資訊請參考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License