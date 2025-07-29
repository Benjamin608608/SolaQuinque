# Railway FAISS 向量搜索設定指南

## 🚀 快速解決方案

您的 Railway 部署目前沒有使用 FAISS 向量搜索，所以回答速度很慢。以下是解決步驟：

### 步驟 1: 上傳您的神學資料到 Railway

您有幾個選項：

#### 選項 A: 使用 Railway CLI 上傳檔案
```bash
# 安裝 Railway CLI
npm install -g @railway/cli

# 登入 Railway
railway login

# 連接到您的專案
railway link

# 上傳您的資料檔案
railway up --file data/theology_texts.txt
```

#### 選項 B: 直接在 Railway 控制台上傳
1. 前往 [Railway Dashboard](https://railway.app/dashboard)
2. 選擇您的 `theologian2` 專案
3. 點擊 "Variables" 標籤
4. 在 "Files" 部分上傳您的神學資料檔案

### 步驟 2: 建立 FAISS 索引

在 Railway 控制台中執行以下命令：

```bash
npm run railway-build-index
```

或者，您可以在 Railway 的 "Deployments" 標籤中：
1. 點擊最新的部署
2. 在 "Terminal" 中執行：
```bash
node scripts/railway-build-index.js
```

### 步驟 3: 驗證設定

檢查 Railway 日誌，您應該看到：
```
✅ FAISS 向量索引建立成功！
📈 已處理 XXXX 個文本片段
🚀 現在可以使用快速向量搜索了！
```

## 📁 支援的檔案格式

Railway 會自動尋找以下檔案：
- `/app/data/theology_texts.txt` - 純文本格式
- `/app/data/theology_data.json` - JSON 格式
- `/app/data/ccel_catalog.json` - CCEL 目錄格式
- `/app/public/ccel_catalog.json` - 現有的 CCEL 檔案

## 🔧 故障排除

### 問題 1: "無法載入檔案"
**解決方案**: 確保您的資料檔案已上傳到正確位置

### 問題 2: "OpenAI API 配額不足"
**解決方案**: 檢查您的 OpenAI API 配額，2GB 資料需要大量 API 調用

### 問題 3: "向量服務初始化失敗"
**解決方案**: 
1. 檢查 Railway 環境變數是否正確設定
2. 確保 `OPENAI_API_KEY` 有效
3. 檢查網路連線

## 📊 預期效果

成功設定後，您應該看到：
- 搜索回應時間從 10-30 秒縮短到 2-5 秒
- Railway 日誌顯示 "使用 FAISS 向量搜索"
- 更準確的搜索結果

## 💡 提示

1. **檔案大小**: 2GB 資料可能需要 10-30 分鐘來建立索引
2. **API 成本**: 建立索引會消耗 OpenAI API 配額
3. **持久性**: Railway 會保存建立的索引，除非重新部署

## 🆘 需要幫助？

如果您遇到問題，請：
1. 檢查 Railway 日誌中的錯誤訊息
2. 確認您的 OpenAI API 配額充足
3. 確保資料檔案格式正確

---

**注意**: 建立 FAISS 索引是一次性過程，之後的搜索會非常快速！ 