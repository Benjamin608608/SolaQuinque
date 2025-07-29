# Google OAuth 設置指南

## 🚨 當前問題

當您點擊 "使用 Google 登入" 按鈕時出現 "Not Found" 錯誤，這是因為 Google OAuth 環境變數未設置。

## 🔧 解決方案

### 選項 1：設置 Google OAuth（推薦）

#### 步驟 1：創建 Google OAuth 憑證

1. **前往 Google Cloud Console**
   - 訪問 [Google Cloud Console](https://console.cloud.google.com/)
   - 登入您的 Google 帳戶

2. **創建新專案或選擇現有專案**
   - 點擊頂部的專案選擇器
   - 選擇或創建一個新專案

3. **啟用 Google+ API**
   - 在左側選單中選擇 "API 和服務" > "程式庫"
   - 搜索 "Google+ API" 並啟用

4. **創建 OAuth 憑證**
   - 前往 "API 和服務" > "憑證"
   - 點擊 "建立憑證" > "OAuth 用戶端 ID"
   - 選擇 "網頁應用程式"
   - 設置應用程式名稱：`神學知識庫`
   - 添加授權的重新導向 URI：
     ```
     https://your-app-name.railway.app/auth/google/callback
     ```
   - 點擊 "建立"

5. **複製憑證資訊**
   - 複製 "用戶端 ID" 和 "用戶端密鑰"

#### 步驟 2：在 Railway 中設置環境變數

在 Railway 儀表板中添加以下環境變數：

```bash
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback
```

**重要：** 將 `your-app-name` 替換為您的實際 Railway 應用程式名稱。

### 選項 2：暫時禁用 Google 登入

如果您暫時不需要 Google 登入功能，可以：

1. **修改前端代碼** - 隱藏登入按鈕
2. **設置基本認證** - 使用簡單的用戶名/密碼
3. **跳過認證** - 直接進入應用程式

## 🔍 驗證設置

設置完成後：

1. **重新部署應用程式**
   - Railway 會自動重新部署

2. **測試 Google 登入**
   - 點擊 "使用 Google 登入" 按鈕
   - 應該會重定向到 Google 登入頁面

3. **檢查日誌**
   - 在 Railway 儀表板中查看部署日誌
   - 確認沒有錯誤訊息

## 🚨 常見問題

### 問題 1：仍然顯示 "Not Found"
**解決方案：**
- 確認環境變數已正確設置
- 檢查 Railway 應用程式名稱是否正確
- 等待 1-2 分鐘讓部署完成

### 問題 2：Google 登入後重定向錯誤
**解決方案：**
- 確認 `GOOGLE_CALLBACK_URL` 設置正確
- 檢查 Google Cloud Console 中的重新導向 URI 設置

### 問題 3：Google 拒絕登入
**解決方案：**
- 確認 Google+ API 已啟用
- 檢查 OAuth 憑證設置
- 確認應用程式狀態為 "已發布"

## 📞 需要幫助？

如果遇到問題：

1. **檢查 Railway 日誌**
   - 在 Railway 儀表板中查看錯誤訊息

2. **驗證環境變數**
   ```bash
   npm run check-env
   ```

3. **測試本地開發**
   ```bash
   npm run dev
   ```

## ✅ 成功指標

設置成功後，您應該能夠：

- ✅ 點擊 "使用 Google 登入" 按鈕
- ✅ 重定向到 Google 登入頁面
- ✅ 成功登入後返回應用程式
- ✅ 看到用戶資訊和登出選項

---

**注意：** 首次設置 Google OAuth 可能需要一些時間才能生效。如果遇到問題，請等待幾分鐘後再試。 