# Railway 完整部署指南

本指南將幫助您將整個神學知識庫應用程式（包括 FAISS 向量庫和 API 伺服器）部署到 Railway。

## 🚀 部署流程

### 1. 準備工作

確保您的 Railway 專案已設定以下環境變數：

```bash
# 必要環境變數
OPENAI_API_KEY=sk-proj-...
VECTOR_STORE_ID=vs_...
SESSION_SECRET=your-secret-key
MONGO_URI=mongodb+srv://...

# Google OAuth (可選)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app.up.railway.app/auth/google/callback
```

### 2. 上傳資料檔案

您有兩種方式提供神學資料檔案：

#### 方法一：Google Drive（推薦）

1. **上傳檔案到 Google Drive**
   - 將您的資料檔案上傳到 Google Drive
   - 右鍵點擊檔案，選擇「取得連結」
   - 複製連結中的檔案 ID

2. **設定檔案 ID**
   - 修改 `config/google-drive.json` 檔案
   - 將 `fileId` 欄位改為您的實際檔案 ID

3. **自動下載**
   - Railway 部署時會自動從 Google Drive 下載檔案
   - 下載的檔案會暫存在 Railway 的檔案系統中

#### 方法二：本地檔案

支援的檔案格式：
- `data/theology_texts.txt` - 純文本檔案
- `data/theology_data.json` - JSON 格式資料
- `data/ccel_catalog.json` - CCEL 目錄資料
- `data/ccel_books.zip` - 壓縮的書籍檔案

**注意**：大型檔案（>100MB）無法提交到 GitHub，建議使用 Google Drive 方法。

### 3. 自動部署流程

當您推送程式碼到 Railway 時，系統會自動執行：

1. **建置階段**：安裝依賴套件
2. **部署階段**：執行 `npm run railway-deploy`
   - 建立 FAISS 向量索引
   - 啟動 API 伺服器

### 4. 部署腳本說明

#### `railway.toml`
```toml
[deploy]
startCommand = "npm run railway-deploy"
```

#### `package.json`
```json
{
  "scripts": {
    "railway-deploy": "npm run railway-build-index && npm start"
  }
}
```

### 5. 監控部署狀態

部署完成後，您可以檢查：

- **健康檢查**：`https://your-app.up.railway.app/api/health`
- **系統狀態**：`https://your-app.up.railway.app/api/info`

### 6. 預期結果

成功部署後，您應該看到：

```
🚀 神學知識庫服務器已啟動
📍 端口: 3000
✅ FAISS 向量服務初始化完成，系統已準備就緒！
📊 已處理 XXXX 個文本片段
```

## 🔧 故障排除

### 常見問題

1. **環境變數未設定**
   - 檢查 Railway Dashboard > Variables
   - 確保所有必要變數都已設定

2. **FAISS 索引建立失敗**
   - 檢查 `OPENAI_API_KEY` 是否有效
   - 確認資料檔案存在且格式正確
   - 查看 Railway 日誌了解詳細錯誤

3. **記憶體不足**
   - Railway 免費版有記憶體限制
   - 考慮升級到付費方案處理大型資料集

### 日誌檢查

在 Railway Dashboard 中查看部署日誌：

```bash
# 成功日誌範例
✅ 找到檔案: /app/data/ccel_books.zip (2048.5 MB)
📦 正在處理壓縮檔案...
✅ 壓縮檔案解壓縮完成
📚 找到 1500 個文本檔案
正在生成嵌入向量...
✅ FAISS 索引建立完成
```

## 📊 效能優化

### 向量搜索優勢

使用 FAISS 向量搜索後，您將體驗：

- **更快的回應速度**：從 30-60 秒縮短到 3-5 秒
- **更準確的答案**：基於語義相似度的智能檢索
- **更好的用戶體驗**：即時回應，無需等待

### 混合搜索策略

系統採用混合搜索策略：

1. **FAISS 向量搜索**：快速檢索相關文檔
2. **GPT-4o-mini 生成**：基於檢索結果生成高品質答案
3. **傳統 Assistant API**：作為備用方案

## 🎯 下一步

部署完成後，您可以：

1. **測試功能**：訪問您的 Railway URL 並測試搜索功能
2. **監控效能**：使用 Railway 的監控工具
3. **擴展功能**：根據需要添加更多神學資料

---

**注意**：首次部署可能需要 5-10 分鐘來建立 FAISS 索引，請耐心等待。後續部署會更快，因為索引已經建立完成。 