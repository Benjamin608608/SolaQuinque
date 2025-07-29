# 獲取 Railway URL 指南

## 🔍 如何找到您的 Railway 應用程式名稱

### 方法 1：從 Railway 儀表板

1. 登入 [Railway 儀表板](https://railway.app)
2. 選擇您的神學知識庫專案
3. 在專案概覽頁面，您會看到：
   - **域名**: `https://your-app-name.railway.app`
   - 或者點擊 "Settings" > "Domains" 查看

### 方法 2：從部署日誌

1. 在 Railway 儀表板中點擊您的專案
2. 點擊 "Deployments" 標籤
3. 查看最新的部署日誌
4. 尋找類似這樣的訊息：
   ```
   Your app is live at: https://your-app-name.railway.app
   ```

### 方法 3：從瀏覽器地址欄

如果您已經訪問過您的應用程式，查看瀏覽器地址欄：
```
https://your-app-name.railway.app
```

## 📝 範例

假設您的 Railway 應用程式名稱是 `theologian-app`，那麼：

- **域名**: `https://theologian-app.railway.app`
- **回調 URL**: `https://theologian-app.railway.app/auth/google/callback`

## ⚠️ 重要提醒

- 確保使用正確的 Railway 域名
- 回調 URL 必須完全匹配
- 不要使用 `localhost` 或開發環境的 URL 