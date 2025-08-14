# Railway 開發環境設置指南

## 🎯 目標
在 Railway 上建立第二個服務，部署 `development` 分支作為開發測試環境。

## 🚀 Step-by-Step 設置步驟

### 步驟 1：登入 Railway Dashboard
1. 前往 [Railway.app](https://railway.app)
2. 使用您的帳戶登入

### 步驟 2：創建新專案
1. 點擊 **"New Project"** 按鈕
2. 選擇 **"Deploy from GitHub repo"**
3. 選擇您的 **`Theologian2-6`** 倉庫（相同倉庫）
4. 專案命名建議：**`Theologian-Development`** 或 **`Theologian-Dev`**

### 步驟 3：設置部署分支
1. 在專案創建後，點擊 **"Settings"** 標籤
2. 找到 **"Source"** 或 **"Deploy"** 設置
3. **重要：** 將 **Branch** 從 `main` 改為 **`development`**
4. 確認 **Root Directory** 設為 `/`（根目錄）

### 步驟 4：設置環境變數
在 Railway 專案中，點擊 **"Variables"** 標籤，添加以下環境變數：

#### 🔧 基本配置
```bash
NODE_ENV=development
PORT=$PORT
```

#### 🤖 OpenAI API 配置
```bash
# 可以使用相同的 API Key
OPENAI_API_KEY=your_openai_api_key_here

# 建議使用不同的向量庫 ID 避免測試資料污染正式環境
VECTOR_STORE_ID=vs_dev_your_development_vector_store_id
```

#### 🔑 Google OAuth 配置（重要）
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ⚠️ 關鍵：使用開發環境域名
GOOGLE_CALLBACK_URL=https://your-dev-app-name.railway.app/auth/google/callback
```

#### 🌐 環境 URL 配置
```bash
# ⚠️ 關鍵：使用開發環境域名
PUBLIC_BASE_URL=https://your-dev-app-name.railway.app
```

#### 🔐 Session 配置
```bash
# 建議使用不同的 Session Secret
SESSION_SECRET=your_development_session_secret
```

#### 📊 SEO 和分析配置（可選）
```bash
# 開發環境可以使用測試值或跳過
GOOGLE_SITE_VERIFICATION=dev_verification_token
GA_MEASUREMENT_ID=G-DEV-TRACKING-ID
```

#### 📝 Google Sheets 配置（可選）
```bash
# 建議為開發環境創建獨立的 Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=your_dev_spreadsheet_id
GOOGLE_CLIENT_EMAIL=dev-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_DEV_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

### 步驟 5：獲取開發環境域名
1. 部署完成後，Railway 會自動生成域名
2. 域名格式通常是：`https://your-project-name.railway.app`
3. 記下這個域名，稍後需要用於 Google OAuth 設置

### 步驟 6：更新 Google OAuth 設置
1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 選擇您的專案
3. 前往 **"API 和服務" > "憑證"**
4. 編輯現有的 OAuth 2.0 憑證
5. 在 **"授權重新導向 URI"** 中添加：
   ```
   https://your-dev-app-name.railway.app/auth/google/callback
   ```
6. 點擊 **"儲存"**

### 步驟 7：更新 Railway 環境變數
現在您知道確切的開發環境域名，更新以下變數：
```bash
GOOGLE_CALLBACK_URL=https://確切的開發環境域名.railway.app/auth/google/callback
PUBLIC_BASE_URL=https://確切的開發環境域名.railway.app
```

### 步驟 8：驗證部署
1. 等待 Railway 重新部署（通常 1-2 分鐘）
2. 訪問開發環境網址
3. 測試基本功能：
   - ✅ 網頁可以正常載入
   - ✅ Google 登入功能正常
   - ✅ 搜索功能正常
   - ✅ 聖經功能正常

## 📊 環境對比表

| 項目 | 正式環境 | 開發環境 |
|------|----------|----------|
| **Railway 專案名稱** | Theologian-Production | Theologian-Development |
| **部署分支** | `main` | `development` |
| **域名** | theologian-production.railway.app | theologian-development.railway.app |
| **NODE_ENV** | `production` | `development` |
| **向量庫** | vs_prod_xxx | vs_dev_xxx |
| **用途** | 正式用戶使用 | 開發測試 |

## 🔄 開發流程

### 日常開發流程
```bash
# 1. 切換到開發分支
git checkout development

# 2. 進行開發和修改
# ... 編輯程式碼 ...

# 3. 提交更改
git add .
git commit -m "新功能：描述"

# 4. 推送到開發環境
git push origin development
# Railway 自動部署到開發環境

# 5. 在開發環境測試
# 訪問 https://your-dev-app.railway.app 測試

# 6. 測試通過後，合併到正式環境
git checkout main
git merge development
git push origin main
# Railway 自動部署到正式環境
```

### 本地開發
```bash
# 使用開發環境配置
cp env.development.example .env.development

# 編輯 .env.development 設置本地配置
# 然後運行：
npm run dev:development
```

## ⚠️ 重要注意事項

### 🔒 資料隔離
- **向量庫**：使用不同的 `VECTOR_STORE_ID`
- **OAuth 憑證**：可以使用相同憑證但添加不同的回調 URL
- **資料庫**：如果使用資料庫，建議開發環境使用獨立資料庫

### 💰 成本控制
- **API 配額**：OpenAI API 配額會在兩環境間共享
- **Railway 資源**：開發環境可以設置較低的資源限制
- **監控使用量**：定期檢查 API 和 Railway 使用量

### 🛡️ 安全考量
- **環境變數**：確保開發環境不使用正式環境的敏感資料
- **測試資料**：避免在開發環境使用真實用戶資料
- **訪問控制**：考慮為開發環境添加基本認證

## 🔧 故障排除

### 常見問題

#### 1. Google 登入失敗
**症狀：** 點擊登入後顯示錯誤
**解決：**
- 檢查 `GOOGLE_CALLBACK_URL` 是否正確
- 確認 Google Cloud Console 中的重新導向 URI 設置
- 等待 10-15 分鐘讓 Google OAuth 設置生效

#### 2. 網頁無法載入
**症狀：** 開發環境網址無法訪問
**解決：**
- 檢查 Railway 部署日誌
- 確認 `development` 分支代碼無誤
- 檢查環境變數設置

#### 3. 功能異常
**症狀：** 搜索或其他功能不正常
**解決：**
- 檢查 `OPENAI_API_KEY` 和 `VECTOR_STORE_ID` 設置
- 查看 Railway 應用程式日誌
- 確認所有必要的環境變數都已設置

## 🎉 設置完成檢查清單

設置完成後，請確認以下項目：

- [ ] Railway 開發專案已創建
- [ ] 部署分支設為 `development`
- [ ] 所有環境變數已設置
- [ ] Google OAuth 回調 URL 已添加
- [ ] 開發環境可以正常訪問
- [ ] Google 登入功能正常
- [ ] 基本搜索功能正常
- [ ] 聖經查詢功能正常

## 📞 需要幫助？

如果遇到問題，可以：

1. **檢查環境變數**：運行 `npm run check-env`
2. **查看部署日誌**：在 Railway Dashboard 中查看
3. **驗證 Google 設置**：運行 `npm run verify-google`
4. **本地測試**：運行 `npm run dev:development`

---

**恭喜！** 您現在有了完全獨立的開發測試環境，可以安全地進行優化和測試，不會影響正式用戶的使用體驗。
