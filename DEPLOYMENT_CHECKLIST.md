# 🚀 部署檢查清單和說明

## 📋 部署前準備

### ✅ 已完成的優化項目
- [x] 無障礙設計改進（ARIA 標籤、觸摸目標）
- [x] 性能監控腳本整合
- [x] 安全性改進（XSS 防護）
- [x] 主題系統優化（系統偏好支援）
- [x] 網路狀態監控
- [x] 響應式設計增強

### 🔧 Railway 環境變數設置

請在 Railway 儀表板中設置以下環境變數：

#### 必需變數
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23
SESSION_SECRET=your-strong-session-secret-here
NODE_ENV=production
```

#### 可選變數（如需 Google 登入）
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback
MONGO_URI=your-mongodb-connection-string
```

## 🚀 部署步驟

### 1. 自動部署（推薦）
```bash
# Railway 會自動檢測到 Git push 並部署
git add .
git commit -m "優化：改進無障礙性、性能和安全性"
git push origin main
```

### 2. 手動部署
```bash
# 本地測試
npm install
npm run check-env
npm start

# 推送到 Railway
git add .
git commit -m "部署：整合所有優化項目"
git push
```

## 🔍 部署後驗證

### 健康檢查端點
- `GET /api/health` - 系統健康狀態
- `GET /api/info` - 系統資訊
- `GET /api/catalog` - 作品目錄

### 功能測試清單
- [ ] 首頁載入正常
- [ ] 搜索功能正常
- [ ] 語言切換功能
- [ ] 聖經查詢功能
- [ ] Google 登入（如已配置）
- [ ] 移動端響應式設計
- [ ] 無障礙功能（鍵盤導航、螢幕閱讀器）
- [ ] 性能監控工作正常
- [ ] 主題切換功能

### 性能指標
使用以下工具檢測：
- Google Lighthouse（目標：90+ 分數）
- GTmetrix
- WebPageTest

### 監控項目
- [ ] 記憶體使用正常（< 100MB）
- [ ] 頁面載入時間 < 3秒
- [ ] 無 JavaScript 錯誤
- [ ] 網路連接狀態監控正常

## 🐛 故障排除

### 常見問題
1. **"Not Found" 錯誤**
   - 檢查環境變數設置
   - 確認 OPENAI_API_KEY 有效

2. **Google 登入失敗**
   - 確認 GOOGLE_CALLBACK_URL 正確
   - 檢查 Google OAuth 設置

3. **性能問題**
   - 檢查記憶體使用
   - 確認 NODE_OPTIONS 設置

### 有用的除錯命令
```bash
# 檢查環境變數
npm run check-env

# 檢查部署狀態
npm run check-deployment

# 檢查 Google OAuth
npm run check-google
```

## 📈 部署後優化建議

1. **CDN 配置**：為靜態資源配置 CDN
2. **快取策略**：設置適當的瀏覽器快取
3. **監控設置**：配置錯誤追蹤和性能監控
4. **備份策略**：定期備份重要數據
5. **安全更新**：定期更新依賴套件

## 🔗 相關文檔
- [Railway 部署指南](./RAILWAY_DEPLOYMENT.md)
- [環境變數說明](./env.example)
- [故障排除指南](./DEPLOYMENT.md)