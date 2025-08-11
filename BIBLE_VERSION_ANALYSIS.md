# 網站聖經版本分析報告

## 您網站目前使用的聖經版本

### 1. 主要版本

**CUV (Chinese Union Version) - 和合本**
- **代碼**: `CUV`
- **顯示名稱**: "和合本(CUV)"
- **API來源**: bolls.life
- **狀態**: ✅ 正在使用中

**KJV (King James Version) - 英王欽定本**
- **代碼**: `KJV`
- **顯示名稱**: "KJV"
- **API來源**: bolls.life
- **狀態**: ✅ 正在使用中

### 2. API整合詳情

#### 後端API端點
```javascript
// server.js 中的實現
app.get('/api/bible/chapter', async (req, res) => {
  const translation = (req.query.translation || 'CUV').toString().toUpperCase();
  const upstreamUrl = `https://bolls.life/get-text/${encodeURIComponent(translation)}/${bookId}/${chapter}/`;
  // ...
});
```

#### 前端選擇器
```html
<select id="bibleVersion" class="border rounded px-2 py-1 text-sm">
  <option value="CUV">和合本(CUV)</option>
  <option value="KJV">KJV</option>
</select>
```

### 3. 版本對比分析

| 版本代碼 | 您的網站 | 信望愛站API | bolls.life API | 狀態 |
|---------|---------|------------|---------------|------|
| CUV | ✅ 使用中 | ❌ 不存在 | ✅ 可用 | 匹配 |
| KJV | ✅ 使用中 | ✅ 可用 | ✅ 可用 | 匹配 |
| UNV | ❌ 未使用 | ✅ 可用 | ✅ 可用 | 可擴展 |
| RCUV | ❌ 未使用 | ✅ 可用 | ✅ 可用 | 可擴展 |

### 4. API回應格式

#### bolls.life API格式 (您網站目前使用)
```json
{
  "0": {"pk": 557983, "verse": 1, "text": "起 初 ， 　 神 創 造 天 地 。"},
  "1": {"pk": 557984, "verse": 2, "text": "地 是 空 虛 混 沌 ， 淵 面 黑 暗 ； 　 神 的 靈 運 行 在 水 面 上 。"},
  // ...
}
```

#### 信望愛站API格式 (我們新創建的腳本)
```json
{
  "status": "success",
  "record": [
    {"engs": "Gen", "chineses": "創", "chap": 1, "sec": 1, "bible_text": "起初，　神創造天地。"},
    // ...
  ]
}
```

### 5. 建議和選項

#### 選項1: 保持現狀
- **優點**: 不需要修改現有代碼
- **缺點**: 版本選擇有限
- **建議**: 如果CUV和KJV滿足需求，可以保持現狀

#### 選項2: 擴展現有系統
- 在bolls.life API中添加更多版本
- 修改前端選擇器
- 優點: 保持API一致性

#### 選項3: 整合信望愛站API
- 添加信望愛站API作為備選
- 提供更多中文版本選擇
- 優點: 更多版本選擇

### 6. 可用的額外版本

#### bolls.life API中可用的版本
- `UNV` - FHL和合本
- `RCUV` - 和合本2010
- `CUVS` - 簡體和合本
- `CUVT` - 繁體和合本
- `ASV` - American Standard Version
- `NIV` - New International Version
- `ESV` - English Standard Version

#### 信望愛站API中可用的版本
- `unv` - FHL和合本
- `rcuv` - 和合本2010
- `tcv95` - 現代中文譯本1995版
- `tcv2019` - 現代中文譯本2019版
- `csb` - 中文標準譯本

### 7. 實施建議

#### 短期方案 (推薦)
1. 保持現有的CUV和KJV版本
2. 使用我們創建的腳本抓取完整聖經文字檔案
3. 將文字檔案保存到GitHub作為備份

#### 中期方案
1. 在bolls.life API中添加UNV和RCUV版本
2. 更新前端選擇器
3. 提供更多中文版本選擇

#### 長期方案
1. 考慮整合多個API來源
2. 實現版本對比功能
3. 添加經文搜索和分析功能

### 8. 腳本使用

#### 抓取您網站目前使用的版本
```bash
# 使用bolls.life API抓取CUV和KJV
npm run fetch-bolls-bible
```

#### 抓取信望愛站版本
```bash
# 使用信望愛站API抓取更多版本
npm run fetch-bible
```

#### 檢查可用版本
```bash
# 檢查bolls.life可用版本
npm run check-bolls-versions

# 檢查信望愛站可用版本
npm run check-bible-versions
```

## 結論

您的網站目前使用的是 **CUV (和合本)** 和 **KJV (英王欽定本)** 版本，通過 bolls.life API 提供服務。這兩個版本都能正常工作，並且我們已經創建了相應的腳本來抓取完整的聖經文字檔案。

如果您需要更多版本選擇，可以考慮擴展到其他可用的版本，或者整合信望愛站API來提供更多中文譯本選擇。 