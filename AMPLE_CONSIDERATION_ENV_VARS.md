# ample-consideration 開發環境變數設置

## 🎯 您的開發環境資訊
- **服務名稱**: ample-consideration
- **域名**: https://ample-consideration.railway.app
- **專案**: trustworthy-enjoyment

---

## 📋 環境變數設置清單

### ⚠️ 必須修改的變數

```bash
NODE_ENV=development
GOOGLE_CALLBACK_URL=https://ample-consideration.railway.app/auth/google/callback
PUBLIC_BASE_URL=https://ample-consideration.railway.app
```

### ✅ 可以保持相同的變數

```bash
PORT=$PORT
OPENAI_API_KEY=your_existing_openai_key
VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23
GOOGLE_CLIENT_ID=your_existing_google_client_id
GOOGLE_CLIENT_SECRET=your_existing_google_client_secret
SESSION_SECRET=your_existing_session_secret
```

### 📝 可選變數

```bash
GOOGLE_SITE_VERIFICATION=dev_verification_token
GA_MEASUREMENT_ID=G-DEV-TRACKING-ID
```

---

## 🔧 設置步驟

### 1️⃣ 修復部署分支
目前顯示 "Deploy failed"，需要：
1. 點擊左側的 **Source** 設置
2. 將分支從 `main` 改為 `development`
3. 確認 Root Directory 為 `/`

### 2️⃣ 設置環境變數
1. 點擊 **Variables** 標籤
2. 添加上述環境變數
3. 特別注意設置正確的回調 URL

### 3️⃣ 更新 Google OAuth
在 Google Cloud Console 中添加：
```
https://ample-consideration.railway.app/auth/google/callback
```

### 4️⃣ 觸發重新部署
設置完成後，Railway 會自動重新部署

---

## 🚀 快速複製清單

```bash
NODE_ENV=development
PORT=$PORT
GOOGLE_CALLBACK_URL=https://ample-consideration.railway.app/auth/google/callback
PUBLIC_BASE_URL=https://ample-consideration.railway.app
```

其他變數可以複製正式環境的值。

---

## 🔍 部署成功後測試

訪問：https://ample-consideration.railway.app

測試項目：
- ✅ 網頁載入正常
- ✅ Google 登入功能
- ✅ 搜索功能
- ✅ 聖經查詢功能
