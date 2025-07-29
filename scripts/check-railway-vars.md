# Railway 環境變數檢查指南

## 🔍 檢查 Railway 中的 GOOGLE_CALLBACK_URL

請在 Railway 儀表板中確認：

### 正確的設置應該是：
```
GOOGLE_CALLBACK_URL=https://theologian2-production.up.railway.app/auth/google/callback
```

### 檢查要點：
1. **完全匹配** - 必須與 Google Cloud Console 中的設置完全一致
2. **沒有多餘空格** - 確保沒有前後空格
3. **正確的域名** - 使用 `theologian2-production.up.railway.app`
4. **正確的路徑** - 包含 `/auth/google/callback`

## 🔧 如果設置不正確：

1. **更新 Railway 環境變數**
   - 前往 Railway 儀表板
   - 點擊 "Variables" 標籤
   - 編輯 `GOOGLE_CALLBACK_URL`
   - 設置為：`https://theologian2-production.up.railway.app/auth/google/callback`

2. **等待重新部署**
   - Railway 會自動重新部署
   - 等待 1-2 分鐘

3. **清除瀏覽器快取**
   - 清除瀏覽器快取和 Cookie
   - 或使用無痕模式

## ✅ 驗證步驟：

1. **檢查 Railway 變數**
   - 確認 `GOOGLE_CALLBACK_URL` 設置正確

2. **檢查 Google Cloud Console**
   - 確認重新導向 URI 設置正確

3. **等待生效**
   - 等待 10-15 分鐘讓設置生效

4. **測試登入**
   - 使用無痕模式測試
   - 或清除瀏覽器快取後測試 