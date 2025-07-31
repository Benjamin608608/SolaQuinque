# 內建瀏覽器 Google OAuth 兼容性設置指南

## 🚨 問題描述

當用戶在 LINE、Instagram、Facebook 等內建瀏覽器中打開應用程式時，會遇到 Google OAuth `403: disallowed_useragent` 錯誤。

## 🔧 解決方案

### 方案 1：修改 Google OAuth 應用設置（推薦）

#### 步驟 1：更新 Google Cloud Console 設置

1. **前往 Google Cloud Console**
   - 訪問 [Google Cloud Console](https://console.cloud.google.com/)
   - 登入您的 Google 帳戶

2. **選擇您的專案**
   - 點擊頂部的專案選擇器
   - 選擇您的神學知識庫專案

3. **前往 OAuth 憑證設置**
   - 在左側選單中選擇 "API 和服務" > "憑證"
   - 找到您的 OAuth 2.0 用戶端 ID
   - 點擊編輯（鉛筆圖標）

4. **修改應用程式設置**
   - **應用程式類型**：確保選擇 "網頁應用程式"
   - **應用程式名稱**：`神學知識庫`
   - **授權的 JavaScript 來源**：
     ```
     https://your-app-name.railway.app
     https://localhost:3000
     ```
   - **授權的重新導向 URI**：
     ```
     https://your-app-name.railway.app/auth/google/callback
     http://localhost:3000/auth/google/callback
     ```

5. **重要：啟用內建瀏覽器支援**
   - 在 "進階設定" 部分
   - 找到 "允許的用戶代理" 或 "User Agent 限制"
   - **取消勾選** "限制用戶代理" 或類似選項
   - 或者添加以下用戶代理到白名單：
     ```
     Line
     Instagram
     Facebook
     Twitter
     WhatsApp
     Telegram
     WeChat
     ```

6. **保存設置**
   - 點擊 "儲存" 按鈕
   - 等待 1-2 分鐘讓設置生效

#### 步驟 2：更新 OAuth 同意畫面

1. **前往 OAuth 同意畫面**
   - 在左側選單中選擇 "API 和服務" > "OAuth 同意畫面"

2. **修改應用程式資訊**
   - **應用程式名稱**：`神學知識庫`
   - **用戶支援電子郵件**：您的電子郵件
   - **開發人員聯絡資訊**：您的電子郵件

3. **添加範圍**
   - 點擊 "新增或移除範圍"
   - 添加以下範圍：
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/userinfo.email`

4. **測試用戶**
   - 在 "測試用戶" 部分
   - 添加您自己和測試用戶的電子郵件地址

5. **發布狀態**
   - 如果應用程式仍為 "測試" 狀態
   - 考慮發布到 "生產" 狀態（需要 Google 審核）

### 方案 2：使用 Google Identity Services（更現代的方法）

#### 步驟 1：啟用 Google Identity Services

1. **在 Google Cloud Console 中**
   - 前往 "API 和服務" > "程式庫"
   - 搜索並啟用 "Google Identity Services API"

2. **更新 OAuth 設置**
   - 在 OAuth 憑證中添加：
   - **授權的 JavaScript 來源**：
     ```
     https://your-app-name.railway.app
     https://localhost:3000
     https://accounts.google.com
     ```

#### 步驟 2：修改後端代碼（可選）

如果您想要更強的內建瀏覽器支援，可以考慮：

1. **使用 Google Identity Services**
2. **實現自定義 OAuth 流程**
3. **使用 Google Sign-In for Websites**

### 方案 3：使用 Google One Tap（最現代的方法）

#### 優點：
- ✅ 完全支援內建瀏覽器
- ✅ 更好的用戶體驗
- ✅ 更安全的認證流程

#### 實施步驟：

1. **在 Google Cloud Console 中**
   - 啟用 "Google Identity Services API"
   - 設置 OAuth 同意畫面

2. **添加 Google One Tap 到前端**
   ```html
   <script src="https://accounts.google.com/gsi/client"></script>
   <div id="g_id_onload"
        data-client_id="YOUR_GOOGLE_CLIENT_ID"
        data-callback="handleCredentialResponse">
   </div>
   ```

## 🔍 驗證設置

### 測試步驟：

1. **在 Google Cloud Console 中**
   - 確認 OAuth 憑證設置正確
   - 確認沒有用戶代理限制

2. **在 Railway 中**
   - 確認環境變數設置正確
   - 重新部署應用程式

3. **測試內建瀏覽器**
   - 在 LINE 中打開應用程式
   - 嘗試 Google 登入
   - 檢查是否仍然出現 `disallowed_useragent` 錯誤

### 常見問題解決：

#### 問題 1：仍然出現 `disallowed_useragent`
**解決方案：**
- 確認已取消勾選 "限制用戶代理"
- 等待 5-10 分鐘讓設置生效
- 清除瀏覽器快取

#### 問題 2：Google 拒絕登入
**解決方案：**
- 確認 OAuth 同意畫面設置正確
- 檢查測試用戶列表
- 確認應用程式狀態

#### 問題 3：重定向錯誤
**解決方案：**
- 確認重新導向 URI 設置正確
- 檢查 Railway 應用程式 URL
- 確認 HTTPS 設置

## 📱 內建瀏覽器支援狀態

### 完全支援：
- ✅ Chrome（Android）
- ✅ Safari（iOS）
- ✅ Samsung Internet

### 部分支援：
- ⚠️ LINE（需要特殊設置）
- ⚠️ Instagram（需要特殊設置）
- ⚠️ Facebook（需要特殊設置）

### 不支援：
- ❌ 某些舊版內建瀏覽器
- ❌ 企業瀏覽器

## 🚀 最佳實踐

1. **保持設置簡潔**
   - 只添加必要的 JavaScript 來源
   - 只添加必要的重新導向 URI

2. **定期檢查設置**
   - 每月檢查一次 OAuth 設置
   - 確認應用程式狀態

3. **監控錯誤**
   - 設置錯誤監控
   - 追蹤用戶登入失敗率

4. **提供備用方案**
   - 保持當前的內建瀏覽器檢測
   - 提供手動複製連結功能

## ✅ 成功指標

設置成功後，您應該能夠：

- ✅ 在 LINE 中正常使用 Google 登入
- ✅ 在 Instagram 中正常使用 Google 登入
- ✅ 在 Facebook 中正常使用 Google 登入
- ✅ 不再出現 `disallowed_useragent` 錯誤
- ✅ 保持當前的智能檢測和提示功能

---

**注意：** Google OAuth 設置的更改可能需要幾分鐘到幾小時才能完全生效。如果問題持續存在，請等待更長時間或聯繫 Google 支援。 