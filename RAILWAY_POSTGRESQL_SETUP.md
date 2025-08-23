# Railway PostgreSQL 筆記資料庫設置指南

## 🎯 目標
解決 SQLite 資料在 Railway 重新部署時丟失的問題，改用 PostgreSQL 實現資料持久化。

## 📋 設置步驟

### 1. 登入 Railway Dashboard
前往：https://railway.app/dashboard

### 2. 在你的專案中添加 PostgreSQL
1. 點擊專案名稱進入專案頁面
2. 點擊 **"+ New"** 按鈕
3. 選擇 **"Database"** 
4. 選擇 **"Add PostgreSQL"**

### 3. 獲取資料庫連接資訊
PostgreSQL 服務建立後：
1. 點擊 PostgreSQL 服務卡片
2. 進入 **"Variables"** 頁籤
3. 複製 `DATABASE_URL` 的值（格式類似：`postgresql://username:password@host:port/database`）

### 4. 設置環境變數
在你的主應用服務中：
1. 進入 **"Variables"** 頁籤
2. 添加新變數：
   - **變數名稱**: `DATABASE_URL` 
   - **變數值**: 貼上步驟 3 複製的 DATABASE_URL

或者，你也可以使用 Railway 的服務引用：
- **變數名稱**: `DATABASE_URL`
- **變數值**: `${{Postgres.DATABASE_URL}}`（替換 "Postgres" 為你的 PostgreSQL 服務名稱）

### 5. 重新部署應用
1. 在專案頁面點擊你的主應用服務
2. 進入 **"Deployments"** 頁籤  
3. 點擊 **"Deploy"** 按鈕重新部署

## 🔍 驗證設置

部署完成後，檢查日誌：
- ✅ 應該看到：`✅ 使用 PostgreSQL 筆記資料庫`
- ❌ 如果看到：`✅ 使用 SQLite 筆記資料庫（備用）`，表示 PostgreSQL 連接失敗

## 📊 系統行為

### 有 PostgreSQL 時：
- 使用 PostgreSQL 儲存筆記
- 資料在重新部署時不會丟失
- 支援更高並發性能

### 沒有 PostgreSQL 時：
- 自動退回到 SQLite（備用）
- 每次重新部署會丟失資料
- 顯示警告訊息

## 🚨 重要提醒

1. **第一次遷移後**，舊的 SQLite 筆記不會自動轉移到 PostgreSQL
2. **重新部署前**，請確保已正確設置 DATABASE_URL
3. **測試環境**：建議先在測試專案中驗證設置正確性

## 📞 支援

如遇問題，請檢查：
1. DATABASE_URL 環境變數是否正確設置
2. PostgreSQL 服務是否正常運行
3. 網路連接是否穩定

設置完成後，你的筆記資料將安全地儲存在 PostgreSQL 中，重新部署時不再丟失！✨
