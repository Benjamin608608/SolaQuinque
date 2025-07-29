# Railway 部署指南

## 環境變數設定

在 Railway 中需要設定以下環境變數：

### 必要環境變數
- `OPENAI_API_KEY`: OpenAI API 密鑰
- `VECTOR_STORE_ID`: OpenAI Vector Store ID  
- `MONGODB_URI`: MongoDB 連接字符串
- `GOOGLE_CLIENT_ID`: Google OAuth 客戶端 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 客戶端密鑰
- `SESSION_SECRET`: 會話密鑰
- `GOOGLE_DRIVE_API_KEY`: Google Drive API 密鑰（用於訪問公開資料夾）

### 可選環境變數
- `NODE_ENV`: 設為 `production`
- `PORT`: 端口號（Railway 會自動設定）

## 部署流程

1. 推送代碼到 GitHub
2. 在 Railway 中連接 GitHub 倉庫
3. 設定環境變數
4. 部署會自動觸發 `railway-build-index` 腳本
5. 系統會自動下載 Google Drive 資料並建立 FAISS 索引

## Google Drive API 設置

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新項目或選擇現有項目
3. 啟用 Google Drive API
4. 創建 API 密鑰
5. 將 API 密鑰設為 `GOOGLE_DRIVE_API_KEY` 環境變數

## 自動化流程

- `scripts/railway-build-index.js` 會在部署時自動執行
- 系統會從 Google Drive 下載所有文本文件
- 自動建立 FAISS 向量索引
- 支援超過 1300 個文本文件的大規模知識庫 