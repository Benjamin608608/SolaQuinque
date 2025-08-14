# URL 管理策略

## 🎯 問題
正式環境和開發環境需要不同的域名，但共用相同的代碼庫。

## 💡 解決方案：完全動態替換

### 📋 策略說明
1. **所有 HTML 文件使用占位符** `https://your-domain.example`
2. **server.js 運行時動態替換** 為實際域名
3. **通過環境變數** `PUBLIC_BASE_URL` 控制

### 🔧 需要修改的文件

#### 1️⃣ public/index.html
```html
<!-- 將所有這些 URL： -->
https://theologian2-production.up.railway.app

<!-- 改為： -->
https://your-domain.example
```

#### 2️⃣ public/sitemap.xml
```xml
<!-- 將所有 URL 改為： -->
<loc>https://your-domain.example/</loc>
<loc>https://your-domain.example/bible</loc>
<!-- ... 等等 -->
```

#### 3️⃣ public/robots.txt
```
Sitemap: https://your-domain.example/sitemap.xml
```

#### 4️⃣ public/privacy.html
```html
<p><strong>網站：</strong> https://your-domain.example</p>
```

#### 5️⃣ public/terms.html
```html
<p><strong>網站：</strong> https://your-domain.example</p>
```

### ✅ 環境變數設置

#### 正式環境
```bash
PUBLIC_BASE_URL=https://theologian2-production.up.railway.app
```

#### 開發環境
```bash
PUBLIC_BASE_URL=https://ample-consideration.railway.app
```

### 🔄 工作流程

1. **開發時**: 在 development 分支修改代碼
2. **測試**: 在開發環境測試功能
3. **合併**: 將 development 合併到 main
4. **部署**: 正式環境自動部署

### 🎉 優勢

- ✅ **無分支衝突**: HTML 文件內容相同
- ✅ **環境隔離**: 通過環境變數控制域名
- ✅ **易於維護**: 單一代碼庫管理
- ✅ **自動化**: server.js 自動處理 URL 替換

### 🚀 server.js 現有邏輯（無需修改）

```javascript
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(filePath, 'utf8');
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    if (base) {
      html = html.replace(/https:\/\/your-domain\.example/g, base.replace(/\/$/, ''));
    }
    // ... 其他處理 ...
    res.send(html);
  } catch (e) {
    res.sendFile(filePath);
  }
});
```

### 📝 實施步驟

1. **修改所有 public/*.html 文件** - 將正式版 URL 改為 `https://your-domain.example`
2. **修改 public/sitemap.xml** - 所有 URL 改為占位符
3. **修改 public/robots.txt** - Sitemap URL 改為占位符
4. **確認環境變數設置正確**
5. **測試開發環境**
6. **合併到正式環境測試**

### 🔍 驗證方法

#### 開發環境測試
```bash
curl https://ample-consideration.railway.app
# 檢查 HTML 中的 URL 是否正確替換
```

#### 正式環境測試
```bash
curl https://theologian2-production.up.railway.app
# 檢查 HTML 中的 URL 是否正確替換
```

---

**總結**: 這個方案完美解決了跨環境 URL 管理問題，確保代碼統一且無衝突。
