# 作者中英文對照表功能實現

## 功能概述

本功能實現了神學知識庫系統中作者名稱的中英文對照顯示，讓用戶可以根據語言設定查看相應的作者名稱。

## 實現的功能

### 1. 作者對照表配置
- **文件位置**: `config/author-translations.json`
- **內容**: 包含 200+ 位神學家的中英文對照
- **格式**: JSON 格式，英文原名為 key，中文譯名為 value

### 2. 後端實現

#### 2.1 作者對照表載入
```javascript
// 載入作者對照表
async function loadAuthorTranslations() {
  try {
    const translationsPath = path.join(__dirname, 'config', 'author-translations.json');
    if (fs.existsSync(translationsPath)) {
      const data = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
      authorTranslations = data.authors || {};
      console.log('✅ 已載入作者對照表');
    }
  } catch (error) {
    console.warn('⚠️ 無法載入作者對照表:', error.message);
  }
}
```

#### 2.2 作者名稱翻譯函數
```javascript
// 獲取作者名稱（根據語言）
function getAuthorName(englishName, language = 'zh') {
  if (!englishName) return '';
  
  if (language === 'zh' && authorTranslations[englishName]) {
    return authorTranslations[englishName];
  }
  return englishName;
}
```

#### 2.3 API 端點
- **作者對照表 API**: `GET /config/author-translations.json`
- **參考書目 API**: `GET /api/catalog` (已支援作者名稱翻譯)

#### 2.4 搜索功能支援
- 修改了 `processSearchRequest` 函數支援語言參數
- 修改了 `processAnnotationsInText` 函數支援語言參數
- 修改了 `getFileName` 函數支援作者名稱翻譯

### 3. 前端實現

#### 3.1 作者對照表載入
```javascript
// 載入作者對照表
let authorTranslations = {};

async function loadAuthorTranslations() {
  try {
    const response = await fetch('/config/author-translations.json');
    if (response.ok) {
      const data = await response.json();
      authorTranslations = data.authors || {};
    }
  } catch (error) {
    console.warn('無法載入作者對照表:', error);
  }
}
```

#### 3.2 作者名稱顯示函數
```javascript
// 獲取作者名稱（根據當前語言）
function getAuthorName(englishName) {
  if (!englishName) return '';
  
  const currentLang = window.currentLanguage || 'zh';
  if (currentLang === 'zh' && authorTranslations[englishName]) {
    return authorTranslations[englishName];
  }
  return englishName;
}
```

#### 3.3 參考書目顯示
- 修改了 `renderCatalog` 函數來使用翻譯後的作者名稱
- 支援按翻譯後的名稱進行字母分組
- 在語言切換時自動重新載入參考書目

#### 3.4 搜索功能
- 修改了搜索請求來傳遞語言參數
- 支援引用標註中的作者名稱翻譯

### 4. 語言切換功能

#### 4.1 語言切換按鈕
- 中文/English 切換按鈕
- 支援即時切換作者名稱顯示

#### 4.2 動態更新
- 切換語言時自動重新載入作者對照表
- 重新渲染參考書目以更新作者名稱
- 保持用戶當前瀏覽位置

### 5. 測試功能

#### 5.1 測試頁面
- **URL**: `http://localhost:3000/test-author-translations.html`
- **功能**: 
  - 測試作者名稱翻譯
  - 測試 API 端點
  - 語言切換測試

#### 5.2 API 測試
```bash
# 測試作者對照表 API
curl http://localhost:3000/config/author-translations.json

# 測試參考書目 API
curl http://localhost:3000/api/catalog
```

## 使用方式

### 1. 查看參考書目
1. 訪問系統首頁
2. 點擊「參考」按鈕
3. 查看作者列表（中文介面顯示中文譯名）
4. 點擊語言切換按鈕切換顯示語言

### 2. 搜索功能
1. 在搜索框輸入問題
2. 系統會根據當前語言設定顯示引用中的作者名稱
3. 中文介面顯示中文譯名，英文介面顯示英文原名

### 3. 測試功能
1. 訪問 `http://localhost:3000/test-author-translations.html`
2. 測試作者名稱翻譯功能
3. 測試 API 端點功能

## 技術特點

### 1. 性能優化
- 作者對照表在服務器啟動時載入到記憶體
- 前端在頁面載入時載入對照表
- 支援快取機制

### 2. 錯誤處理
- 對照表載入失敗時的降級處理
- API 錯誤的友好提示
- 網路錯誤的重試機制

### 3. 用戶體驗
- 無縫的語言切換
- 保持用戶瀏覽狀態
- 響應式設計支援

### 4. 可維護性
- 模組化的代碼結構
- 清晰的函數命名
- 完整的錯誤日誌

## 作者對照表內容

對照表包含 200+ 位神學家，包括：

### 古代教父
- 聖奧古斯丁 (Augustine, Saint)
- 聖亞他那修 (Athanasius, Saint)
- 聖約翰·金口 (John Chrysostom, St.)

### 中世紀神學家
- 聖托馬斯·阿奎那 (Thomas Aquinas, Saint)
- 聖文德 (Bonaventura, St.)
- 聖大德蘭 (Teresa of Avila, St.)

### 宗教改革時期
- 馬丁·路德 (Martin Luther)
- 約翰·加爾文 (John Calvin)
- 約翰·諾克斯 (John Knox)

### 近代神學家
- 約拿單·愛德華茲 (Jonathan Edwards)
- 查爾斯·哈登·司布真 (Charles Haddon Spurgeon)
- 倪柝聲 (Watchman Nee)

## 未來擴展

### 1. 功能擴展
- 支援更多語言（如日文、韓文等）
- 添加作者簡介和生平
- 支援作者作品的分類顯示

### 2. 性能優化
- 實現更智能的快取策略
- 支援增量更新對照表
- 優化大量作者的載入性能

### 3. 用戶體驗
- 添加作者搜索功能
- 支援模糊匹配
- 添加作者相關性推薦

## 維護說明

### 1. 更新作者對照表
1. 編輯 `config/author-translations.json` 文件
2. 添加新的作者對照
3. 重啟服務器或重新載入對照表

### 2. 添加新語言支援
1. 修改 `getAuthorName` 函數
2. 添加新的語言對照表
3. 更新前端語言切換邏輯

### 3. 故障排除
- 檢查對照表文件格式
- 確認 API 端點正常運行
- 查看瀏覽器控制台錯誤信息 