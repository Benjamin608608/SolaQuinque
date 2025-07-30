# 恢復到 OpenAI 資料庫版本

## 已完成的工作

### ✅ 程式碼恢復
1. **移除 FAISS 向量服務**
   - 刪除了 `services/vectorService.js` 檔案
   - 移除了 `server.js` 中的 FAISS 相關程式碼
   - 恢復到使用 OpenAI Assistant API 的版本

2. **清理依賴**
   - 從 `package.json` 中移除了 `faiss-node` 和 `extract-zip` 依賴
   - 移除了 `node-fetch` 依賴（不再需要）
   - 更新了 `package-lock.json`

3. **簡化程式架構**
   - 移除了複雜的向量服務初始化邏輯
   - 恢復到簡單的 OpenAI Assistant API 調用
   - 移除了背景處理和進度追蹤功能

### ✅ 功能恢復
1. **搜索功能**
   - 使用 OpenAI Assistant API 進行搜索
   - 支援向量資料庫搜索
   - 保持引用格式 `[1], [2], [3]` 等

2. **認證功能**
   - 保持 Google OAuth 登入功能
   - 保持 MongoDB 登入記錄功能

3. **API 端點**
   - `/api/search` - 主要搜索端點
   - `/api/health` - 健康檢查
   - `/api/info` - 系統資訊
   - `/api/catalog` - 作品目錄

### ✅ 環境配置
1. **必需環境變數**
   - `OPENAI_API_KEY` - OpenAI API 金鑰
   - `VECTOR_STORE_ID` - 向量資料庫 ID
   - `SESSION_SECRET` - 會話密鑰

2. **可選環境變數**
   - `GOOGLE_CLIENT_ID` - Google OAuth 客戶端 ID
   - `GOOGLE_CLIENT_SECRET` - Google OAuth 客戶端密鑰
   - `MONGO_URI` - MongoDB 連線字串

## 部署說明

### Railway 部署
1. 確保設置了正確的環境變數
2. 部署後系統會使用 OpenAI Assistant API
3. 不再需要建立本地 FAISS 索引

### 本地開發
```bash
npm install
npm run dev
```

## 系統特色

- 🚀 **快速啟動**: 不需要建立本地向量索引
- 💰 **成本效益**: 直接使用 OpenAI 的向量資料庫
- 🔧 **簡單維護**: 減少了複雜的本地處理邏輯
- 📊 **穩定可靠**: 基於 OpenAI 的成熟 API

## 注意事項

- 確保 `VECTOR_STORE_ID` 指向正確的 OpenAI 向量資料庫
- 系統現在完全依賴 OpenAI 的向量搜索服務
- 不再需要下載和處理本地文件
- 搜索速度取決於 OpenAI API 的響應時間

## 故障排除

如果遇到問題，請檢查：
1. `OPENAI_API_KEY` 是否有效且有足夠額度
2. `VECTOR_STORE_ID` 是否正確
3. 網路連線是否正常
4. 查看 `/api/health` 端點狀態

---

**恢復完成時間**: 2025-01-27
**版本**: OpenAI Assistant API 版本 