# Google Drive API 密鑰設置指南

## 🚀 快速設置

### 1. 獲取 Google Drive API 密鑰

1. **前往 Google Cloud Console**
   - 訪問：https://console.cloud.google.com/
   - 登入您的 Google 帳戶

2. **創建新專案或選擇現有專案**
   - 點擊頂部的專案選擇器
   - 選擇現有專案或創建新專案

3. **啟用 Google Drive API**
   - 在左側選單中選擇「API 和服務」→「程式庫」
   - 搜尋「Google Drive API」
   - 點擊「Google Drive API」並啟用

4. **創建憑證**
   - 在左側選單中選擇「API 和服務」→「憑證」
   - 點擊「建立憑證」→「API 金鑰」
   - 複製生成的 API 金鑰

### 2. 設置環境變數

在您的 `.env` 文件中添加：

```bash
GOOGLE_DRIVE_API_KEY=your_google_drive_api_key_here
```

### 3. 驗證設置

運行以下命令驗證設置：

```bash
node scripts/verify-google-setup.js
```

## 📋 詳細步驟

### 步驟 1：Google Cloud Console 設置

1. **訪問 Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **創建專案**
   - 點擊頂部的專案選擇器
   - 點擊「新增專案」
   - 輸入專案名稱（例如：theology-vectors）
   - 點擊「建立」

3. **啟用 Google Drive API**
   - 在左側選單中選擇「API 和服務」→「程式庫」
   - 搜尋「Google Drive API」
   - 點擊「Google Drive API」
   - 點擊「啟用」

### 步驟 2：創建 API 金鑰

1. **前往憑證頁面**
   - 在左側選單中選擇「API 和服務」→「憑證」
   - 點擊「建立憑證」
   - 選擇「API 金鑰」

2. **複製 API 金鑰**
   - 系統會顯示您的 API 金鑰
   - 複製這個金鑰（格式類似：AIzaSyC...）

3. **限制 API 金鑰（可選但建議）**
   - 點擊「限制金鑰」
   - 在「API 限制」中選擇「限制金鑰」
   - 只選擇「Google Drive API」
   - 點擊「儲存」

### 步驟 3：更新環境變數

編輯您的 `.env` 文件：

```bash
# 現有的 OpenAI API 金鑰
OPENAI_API_KEY=your_openai_api_key_here

# 新增 Google Drive API 金鑰
GOOGLE_DRIVE_API_KEY=your_google_drive_api_key_here
```

### 步驟 4：驗證設置

運行驗證腳本：

```bash
node scripts/verify-google-setup.js
```

如果設置正確，您會看到：
```
✅ Google Drive API 設置正確
✅ 可以訪問神學資料夾
✅ 找到 1321 個文件
```

## 🔧 故障排除

### 問題 1：API 金鑰無效
**解決方案：**
- 確保 API 金鑰格式正確（以 AIzaSy 開頭）
- 檢查是否已啟用 Google Drive API
- 確認 API 金鑰沒有被限制過度

### 問題 2：權限不足
**解決方案：**
- 確保您的 Google 帳戶有權限訪問神學資料夾
- 檢查資料夾是否設為公開或已與您的帳戶共享

### 問題 3：配額限制
**解決方案：**
- Google Drive API 有每日配額限制
- 如果遇到配額問題，請等待 24 小時後重試

## 📊 預期結果

設置完成後，您應該能夠：

1. **下載所有 1321 個神學文件**
2. **生成向量嵌入**
3. **保存本地向量資料**
4. **享受 10-30 倍的速度提升**

## 🎯 下一步

設置完成後，運行向量預處理腳本：

```bash
node scripts/create-local-vectors.js
```

這將：
- 下載所有 1321 個文件
- 生成向量嵌入
- 保存到本地 `data/local-vectors/` 目錄
- 提供詳細的處理報告 