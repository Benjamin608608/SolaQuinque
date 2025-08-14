# 環境變數對比：正式環境 vs 開發環境

## 📊 環境變數設置對比表

| 環境變數 | 正式環境 | 開發環境 | 是否需要修改 | 說明 |
|---------|----------|----------|--------------|------|
| **NODE_ENV** | `production` | `development` | ✅ **必須** | 區分環境類型 |
| **PORT** | `$PORT` | `$PORT` | ❌ 不需要 | Railway 自動設置 |
| **OPENAI_API_KEY** | `sk-xxx` | `sk-xxx` | ❌ 不需要 | 可以共用相同 API Key |
| **VECTOR_STORE_ID** | `vs_6886f711...` | `vs_dev_6886f711...` | 🤔 **建議** | 避免測試資料污染正式資料 |
| **GOOGLE_CLIENT_ID** | `xxx.googleusercontent.com` | `xxx.googleusercontent.com` | ❌ 不需要 | 可以共用相同憑證 |
| **GOOGLE_CLIENT_SECRET** | `GOCSPX-xxx` | `GOCSPX-xxx` | ❌ 不需要 | 可以共用相同憑證 |
| **GOOGLE_CALLBACK_URL** | `https://正式域名.railway.app/auth/google/callback` | `https://ideal-blessing.railway.app/auth/google/callback` | ✅ **必須** | 使用開發環境域名 |
| **SESSION_SECRET** | `your_secret_123` | `dev_secret_456` | 🤔 **建議** | 增加安全性 |
| **PUBLIC_BASE_URL** | `https://正式域名.railway.app` | `https://ideal-blessing.railway.app` | ✅ **必須** | 使用開發環境域名 |
| **GOOGLE_SITE_VERIFICATION** | `real_token` | `dev_token` | ❌ 可選 | 開發環境可跳過 |
| **GA_MEASUREMENT_ID** | `G-REAL123` | `G-DEV456` | ❌ 可選 | 開發環境可跳過 |

## 🎯 簡化版：最小修改清單

如果您想要最簡單的設置，**只需要修改這 3 個變數**：

### ✅ 必須修改的環境變數

```bash
# 1. 環境類型
NODE_ENV=development

# 2. OAuth 回調 URL
GOOGLE_CALLBACK_URL=https://ideal-blessing.railway.app/auth/google/callback

# 3. 基礎 URL
PUBLIC_BASE_URL=https://ideal-blessing.railway.app
```

### 📋 保持相同的環境變數

```bash
# 這些可以直接複製正式環境的值
OPENAI_API_KEY=your_existing_openai_key
VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23
GOOGLE_CLIENT_ID=your_existing_google_client_id
GOOGLE_CLIENT_SECRET=your_existing_google_client_secret
SESSION_SECRET=your_existing_session_secret
PORT=$PORT
```

## 🤔 為什麼建議修改 VECTOR_STORE_ID？

### 選項 1：共用向量庫（簡單）
**優點：** 設置簡單，無需額外配置
**缺點：** 開發測試可能影響正式環境資料

### 選項 2：獨立向量庫（推薦）
**優點：** 完全隔離，安全測試
**缺點：** 需要額外設置

### 如何創建開發環境向量庫？
如果您選擇使用獨立向量庫，需要：
1. 在 OpenAI 中創建新的向量庫
2. 使用開發環境專用的 ID
3. 或者在現有 ID 前加上前綴：`vs_dev_6886f711...`

## 🔧 Google OAuth 設置

### 重要：添加開發環境回調 URL

無論您選擇哪種方案，都**必須**在 Google Cloud Console 中添加：

```
https://ideal-blessing.railway.app/auth/google/callback
```

**步驟：**
1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 選擇您的專案
3. 前往 "API 和服務" > "憑證"
4. 編輯現有的 OAuth 2.0 憑證
5. 在 "授權重新導向 URI" 中**添加**新的 URL（不要刪除現有的）
6. 點擊 "儲存"

## 💡 推薦的設置策略

### 🥇 方案一：最小修改（推薦新手）
只修改必要的 3 個變數，其他保持相同

### 🥈 方案二：完全隔離（推薦進階）
修改所有建議的變數，創建完全獨立的開發環境

### 🥉 方案三：混合方案
修改必要變數 + 獨立向量庫，其他保持相同

## ⚠️ 注意事項

1. **API 配額共享**：如果共用 OPENAI_API_KEY，兩環境會共享 API 配額
2. **資料安全**：如果共用 VECTOR_STORE_ID，測試可能影響正式資料
3. **成本控制**：開發環境的 API 使用會計入總配額

---

**建議：** 開始時使用方案一（最小修改），等熟悉後再考慮完全隔離。
