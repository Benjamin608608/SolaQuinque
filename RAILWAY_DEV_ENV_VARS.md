# Railway 開發環境變數設置清單

## 🎯 為 ideal-blessing.railway.app 開發環境準備

基於您的 Railway 服務域名 `ideal-blessing.railway.app`，以下是完整的環境變數設置清單：

---

## 📋 必要環境變數 (複製到 Railway Variables)

### 🔧 基本配置
```
NODE_ENV=development
PORT=$PORT
```

### 🤖 OpenAI API 配置
```
OPENAI_API_KEY=your_openai_api_key_here
```
**說明：** 可以使用與正式環境相同的 API Key

### 📊 向量資料庫配置
```
VECTOR_STORE_ID=vs_dev_6886f711eda0819189b6c017d6b96d23
```
**說明：** 建議為開發環境創建獨立的向量庫，或在現有 ID 前加 `vs_dev_` 前綴

### 🔑 Google OAuth 配置
```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=https://ideal-blessing.railway.app/auth/google/callback
```
**重要：** 您需要在 Google Cloud Console 中添加這個回調 URL

### 🌐 環境 URL 配置
```
PUBLIC_BASE_URL=https://ideal-blessing.railway.app
```

### 🔐 Session 配置
```
SESSION_SECRET=dev_your_session_secret_here_2025
```
**說明：** 建議使用與正式環境不同的 Session Secret

---

## 📋 可選環境變數

### 📊 SEO 和分析配置
```
GOOGLE_SITE_VERIFICATION=dev_verification_token
GA_MEASUREMENT_ID=G-DEV-XXXXXXX
```
**說明：** 開發環境可以使用測試值或跳過

### 📝 Google Sheets 紀錄配置
```
GOOGLE_SHEETS_SPREADSHEET_ID=your_dev_spreadsheet_id
GOOGLE_CLIENT_EMAIL=dev-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_DEV_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```
**說明：** 建議為開發環境創建獨立的 Google Sheets

---

## 🔄 設置步驟

### 步驟 1：在 Railway 中設置環境變數
1. 進入您的 `ideal-blessing` 服務
2. 點擊 **"Variables"** 標籤
3. 逐一添加上述必要環境變數
4. 確保將 `your_xxx_here` 替換為實際值

### 步驟 2：修改分支設置
1. 進入 **"Settings"** 標籤
2. 找到 **"Source"** 設置
3. 將 **Branch** 從 `main` 改為 **`development`**
4. 點擊儲存

### 步驟 3：更新 Google Cloud Console
1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 選擇您的專案
3. 前往 **"API 和服務" > "憑證"**
4. 編輯現有的 OAuth 2.0 憑證
5. 在 **"授權重新導向 URI"** 中添加：
   ```
   https://ideal-blessing.railway.app/auth/google/callback
   ```
6. 點擊 **"儲存"**

### 步驟 4：等待部署完成
- Railway 會自動重新部署
- 通常需要 2-3 分鐘

### 步驟 5：測試開發環境
訪問 `https://ideal-blessing.railway.app` 並測試：
- ✅ 網頁正常載入
- ✅ Google 登入功能
- ✅ 搜索功能
- ✅ 聖經查詢功能

---

## ⚠️ 重要提醒

### 🔒 安全注意事項
- **OPENAI_API_KEY**: 可以與正式環境共用，但要注意 API 配額
- **GOOGLE_CLIENT_ID/SECRET**: 可以使用相同憑證，但要添加新的回調 URL
- **SESSION_SECRET**: 建議使用不同的值
- **VECTOR_STORE_ID**: 強烈建議使用獨立的開發環境向量庫

### 💰 成本控制
- OpenAI API 配額會在兩環境間共享
- 建議監控 API 使用量
- 開發環境可以設置較低的資源限制

### 🐛 故障排除
如果遇到問題：
1. 檢查 Railway 部署日誌
2. 確認所有環境變數設置正確
3. 驗證 Google OAuth 回調 URL
4. 等待 10-15 分鐘讓設置生效

---

## 📞 需要幫助？

運行檢查腳本：
```bash
npm run check-railway-dev
```

或手動檢查：
1. 訪問開發環境 URL
2. 查看 Railway 日誌
3. 測試 Google 登入
4. 驗證搜索功能

---

**準備就緒！** 您的開發環境 `ideal-blessing.railway.app` 即將可以使用了！
