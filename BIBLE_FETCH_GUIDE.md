# 聖經版本抓取指南

本專案提供了從信望愛站API自動抓取多個聖經版本的功能。

## 可用的聖經版本

- **FHL和合本 (UNV)** - 繁體中文和合本
- **和合本2010 (RCUV)** - 和合本修訂版2010
- **英王欽定本 (KJV)** - 英文King James Version

## 快速開始

### 1. 測試API連接

首先測試API是否正常工作：

```bash
npm run test-bible-api
```

### 2. 查看可用版本

檢查信望愛站提供的所有聖經版本：

```bash
node scripts/check-available-versions.js
```

### 3. 抓取樣本經文

抓取少量經文進行測試（創世記第1章和約翰福音第3章）：

```bash
node scripts/test-fetch-sample.js
```

### 4. 抓取完整聖經

抓取所有三個版本的完整聖經：

```bash
npm run fetch-bible
```

## 輸出檔案

所有檔案都會保存在 `data/bible-versions/` 目錄下：

- `unv-bible.txt` - FHL和合本完整聖經
- `rcuv-bible.txt` - 和合本2010完整聖經  
- `kjv-bible.txt` - KJV完整聖經
- `unv-sample.txt` - FHL和合本樣本
- `rcuv-sample.txt` - 和合本2010樣本
- `kjv-sample.txt` - KJV樣本

## 檔案格式

每個輸出檔案包含：

```
# [版本名稱] 聖經

獲取時間: [時間戳]

# [書卷名稱]

=== [書卷名稱] 第[章]章 ===

1. [經文內容]
2. [經文內容]
...
```

## 注意事項

### 執行時間
- 完整抓取需要約30-60分鐘
- 腳本包含延遲機制以避免API過載
- 建議在網路穩定的環境下執行

### API限制
- 請遵守信望愛站的版權規定
- 不要過於頻繁地請求API
- 僅用於教育和研究目的

### 錯誤處理
- 腳本會自動處理網路錯誤
- 無效的API回應會被記錄
- 執行過程中的錯誤不會中斷整個流程

## 技術細節

### 依賴項
- `node-fetch` - HTTP請求
- `fs.promises` - 檔案操作
- `path` - 路徑處理

### API端點
- 基礎URL: `https://bible.fhl.net/json`
- 經文查詢: `/qb.php`
- 版本列表: `/ab.php`

### 參數說明
- `chineses` - 中文書卷縮寫
- `chap` - 章節
- `version` - 聖經版本代碼
- `strong` - 是否包含Strong's number (0=否)
- `gb` - 繁簡體選擇 (0=繁體)

## 版權聲明

本工具僅用於教育和研究目的。請遵守信望愛站的版權規定：
https://www.fhl.net/main/fhl/fhl8.html

## 故障排除

### 常見問題

1. **"fetch is not a function" 錯誤**
   - 確保已安裝依賴項：`npm install`

2. **API請求失敗**
   - 檢查網路連接
   - 確認信望愛站API可用性

3. **檔案保存失敗**
   - 確保有寫入權限
   - 檢查磁碟空間

### 支援

如有問題，請檢查：
- Node.js版本 (建議 >= 16.0.0)
- 網路連接狀態
- API服務可用性 