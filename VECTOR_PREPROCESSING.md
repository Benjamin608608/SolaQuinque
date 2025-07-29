# 向量資料預處理方案

## 概述

為了解決 Railway 部署時的超時問題和提高系統啟動速度，我們實現了向量資料預處理方案。這個方案將文本處理和向量生成的工作轉移到本地環境，Railway 只需要載入預處理好的向量資料。

## 優勢

- ✅ **大幅減少 Railway 啟動時間**：從數分鐘縮短到數秒
- ✅ **降低 OpenAI API 成本**：embeddings 只需要生成一次
- ✅ **提高部署穩定性**：避免網路和 API 調用的不確定性
- ✅ **保持高品質**：使用完整的 1300+ 文件，無需妥協
- ✅ **支援版本控制**：向量資料可以版本化管理
- ✅ **支援增量更新**：只需要重新處理改變的文件

## 工作流程

### 1. 本地預處理

```bash
# 設置環境變數
export OPENAI_API_KEY=your_openai_api_key
export GOOGLE_DRIVE_API_KEY=your_google_drive_api_key
export GOOGLE_DRIVE_FOLDER_ID=1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K

# 運行預處理腳本
node scripts/preprocess-vectors.js
```

### 2. 上傳向量資料

將生成的 `data/preprocessed/theology-vectors-compressed.json` 文件上傳到 Google Drive。

### 3. 更新配置

編輯 `config/google-drive-vectors.json`，將 `PLACEHOLDER_VECTOR_FILE_ID` 替換為實際的文件 ID。

### 4. 部署到 Railway

推送代碼到 GitHub，Railway 將自動部署並使用預處理的向量資料。

## 文件結構

```
data/
├── preprocessed/
│   ├── theology-vectors.json              # 完整版本（用於調試）
│   ├── theology-vectors-compressed.json   # 壓縮版本（用於生產）
│   └── processing-report.json             # 處理報告
└── temp/                                  # 臨時下載文件（自動清理）

config/
├── google-drive.json                      # 原始文本配置
└── google-drive-vectors.json              # 向量資料配置

scripts/
└── preprocess-vectors.js                  # 預處理腳本
```

## 向量資料格式

```json
{
  "version": "1.0.0",
  "createdAt": "2025-07-29T15:30:00.000Z",
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "totalFiles": 1300,
  "totalChunks": 50000,
  "chunks": [
    {
      "text": "文本內容...",
      "source": "文件名.txt",
      "chunkIndex": 0,
      "embedding": [0.1, 0.2, ...],
      "metadata": {
        "length": 1500,
        "wordCount": 250
      }
    }
  ]
}
```

## 預處理腳本功能

`scripts/preprocess-vectors.js` 包含以下功能：

- 📋 **文件列表**：使用 Google Drive API v3 獲取所有文件（支援分頁）
- 📥 **批量下載**：並行下載所有 .txt 文件
- ✂️ **智能分割**：將文本分割成語義片段（1500 字符，200 字符重疊）
- 🧠 **向量生成**：批量生成 OpenAI embeddings（每批 50 個）
- 💾 **資料保存**：保存為 JSON 格式，同時生成統計報告
- 🔍 **品質驗證**：驗證資料完整性和格式正確性

## 系統兼容性

修改後的 `VectorService` 支援以下載入順序：

1. **預處理向量資料**：`data/theology-vectors-compressed.json`
2. **Google Drive 向量資料**：通過 `config/google-drive-vectors.json` 配置
3. **傳統文本處理**：原有的文本下載和處理流程
4. **預設文本**：最後的後備方案

## 性能估算

假設處理 1300 個文件：

- **本地預處理時間**：約 2-3 小時（一次性）
- **向量資料大小**：約 200-300 MB
- **Railway 載入時間**：約 10-30 秒
- **API 成本節省**：每次部署節省 $5-10

## 更新策略

### 完整更新
當需要重新處理所有文件時：
```bash
node scripts/preprocess-vectors.js
```

### 增量更新（未來功能）
可以實現只處理新增或修改的文件：
```bash
node scripts/preprocess-vectors.js --incremental
```

## 故障排除

### 常見問題

1. **預處理失敗**
   - 檢查 OpenAI API 密鑰和額度
   - 檢查 Google Drive API 密鑰和權限
   - 檢查網路連接

2. **Railway 載入失敗**
   - 檢查向量資料文件 ID 是否正確
   - 檢查文件是否公開可訪問
   - 檢查文件格式是否正確

3. **向量搜索異常**
   - 檢查向量維度是否一致
   - 檢查 FAISS 索引是否正確建立

### 日誌分析

預處理過程會產生詳細的日誌：
- 📋 文件列表獲取
- 📥 文件下載進度
- ✂️ 文本分割統計
- 🧠 向量生成進度
- 💾 資料保存結果

## 最佳實踐

1. **定期更新**：建議每月重新預處理一次
2. **版本管理**：為不同版本的向量資料打標籤
3. **備份策略**：保留多個版本的向量資料
4. **監控品質**：定期檢查搜索結果的品質

## 未來改進

- [ ] 支援增量更新
- [ ] 自動化 CI/CD 流程
- [ ] 向量資料壓縮優化
- [ ] 多語言支援
- [ ] 更智能的文本分割策略