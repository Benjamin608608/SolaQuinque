// 測試文本監聽翻譯功能
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入作者對照表
let authorTranslations = {};
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

// 文本監聽翻譯函數
function translateTextContent(text, language = 'zh') {
  if (!text || language !== 'zh') {
    return text;
  }
  
  console.log('🔍 開始文本監聽翻譯...');
  let translatedText = text;
  let translationCount = 0;
  
  // 遍歷所有作者對照表
  for (const [englishName, chineseName] of Object.entries(authorTranslations)) {
    // 創建多種匹配模式，按優先級排序
    const patterns = [
      // 方括號模式：[Herman Bavinck (1854-1921)] - 最高優先級
      {
        pattern: new RegExp(`\\[${englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi'),
        replacement: (match, yearMatch) => {
          const year = yearMatch ? yearMatch[1] : '';
          return year ? `[${chineseName} (${year})]` : `[${chineseName}]`;
        }
      },
      // 完整名稱模式：Herman Bavinck (1854-1921) - 中等優先級
      {
        pattern: new RegExp(`\\b${englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
        replacement: (match, yearMatch) => {
          const year = yearMatch ? yearMatch[1] : '';
          return year ? `${chineseName} (${year})` : chineseName;
        }
      },
      // 純名稱模式：Herman Bavinck - 最低優先級
      {
        pattern: new RegExp(`\\b${englishName.split(' (')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
        replacement: () => chineseName
      }
    ];
    
    for (const { pattern, replacement } of patterns) {
      if (pattern.test(translatedText)) {
        // 提取年份信息
        const yearMatch = englishName.match(/\(([^)]+)\)/);
        
        // 執行替換
        translatedText = translatedText.replace(pattern, (match) => {
          const result = replacement(match, yearMatch);
          translationCount++;
          console.log(`✅ 翻譯: "${match}" -> "${result}"`);
          return result;
        });
        
        // 只處理一次，避免重複替換
        break;
      }
    }
  }
  
  console.log(`📊 文本監聽翻譯完成，共翻譯 ${translationCount} 處`);
  return translatedText;
}

// 測試用例
const testCases = [
  {
    name: "完整名稱測試",
    text: "根據 Herman Bavinck (1854-1921) 的神學思想，他認為基督是基督教的核心。另外，Louis Berkhof (1873-1957) 也提出類似的觀點。",
    expected: "根據 赫爾曼·巴文克 (1854-1921) 的神學思想，他認為基督是基督教的核心。另外，路易·伯克富 (1873-1957) 也提出類似的觀點。"
  },
  {
    name: "方括號引用測試",
    text: "根據 [Herman Bavinck (1854-1921)] 的神學思想，他認為基督是基督教的核心。另外，[Louis Berkhof (1873-1957)] 也提出類似的觀點。",
    expected: "根據 [赫爾曼·巴文克 (1854-1921)] 的神學思想，他認為基督是基督教的核心。另外，[路易·伯克富 (1873-1957)] 也提出類似的觀點。"
  },
  {
    name: "純名稱測試",
    text: "Herman Bavinck 是荷蘭著名的改革宗神學家，Louis Berkhof 也是重要的神學家。",
    expected: "赫爾曼·巴文克 是荷蘭著名的改革宗神學家，路易·伯克富 也是重要的神學家。"
  },
  {
    name: "混合模式測試",
    text: "Herman Bavinck (1854-1921) 在其著作中強調，[Louis Berkhof (1873-1957)] 也持相同觀點。",
    expected: "赫爾曼·巴文克 (1854-1921) 在其著作中強調，[路易·伯克富 (1873-1957)] 也持相同觀點。"
  }
];

console.log('🧪 測試文本監聽翻譯功能\n');

testCases.forEach((testCase, index) => {
  console.log(`=== 測試 ${index + 1}: ${testCase.name} ===`);
  console.log(`📝 原始文本: "${testCase.text}"`);
  
  const result = translateTextContent(testCase.text, 'zh');
  
  console.log(`📝 翻譯結果: "${result}"`);
  console.log(`📝 期望結果: "${testCase.expected}"`);
  
  const isCorrect = result === testCase.expected;
  console.log(`${isCorrect ? '✅' : '❌'} 測試 ${isCorrect ? '通過' : '失敗'}\n`);
});

console.log('✅ 文本監聽翻譯功能測試完成'); 