import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入作者對照表
const translationsPath = path.join(__dirname, 'config', 'author-translations.json');
const authorTranslations = JSON.parse(fs.readFileSync(translationsPath, 'utf8')).authors;

// 文本掃描翻譯函數
function scanAndTranslateText(text, language = 'zh') {
    if (!text || language !== 'zh') {
        return text;
    }
    
    console.log('🔍 開始文本掃描翻譯...');
    let translatedText = text;
    let translationCount = 0;
    
    // 遍歷所有作者對照表
    for (const [englishName, chineseName] of Object.entries(authorTranslations)) {
        // 創建多種匹配模式，按優先級排序
        const patterns = [
            // 方括號模式：[Herman Bavinck (1854-1921)] - 最高優先級
            {
                pattern: new RegExp(`\\[${englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi'),
                replacement: (match) => {
                    const yearMatch = englishName.match(/\(([^)]+)\)/);
                    const year = yearMatch ? yearMatch[1] : '';
                    return year ? `[${chineseName} (${year})]` : `[${chineseName}]`;
                }
            },
            // 完整名稱模式：Herman Bavinck (1854-1921) - 中等優先級
            {
                pattern: new RegExp(`\\b${englishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
                replacement: (match) => {
                    const yearMatch = englishName.match(/\(([^)]+)\)/);
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
                // 執行替換
                translatedText = translatedText.replace(pattern, (match) => {
                    const result = replacement(match);
                    translationCount++;
                    console.log(`✅ 文本掃描翻譯: "${match}" -> "${result}"`);
                    return result;
                });
                
                // 只處理一次，避免重複替換
                break;
            }
        }
    }
    
    console.log(`📊 文本掃描翻譯完成，共翻譯 ${translationCount} 處`);
    return translatedText;
}

// 測試文本
const testTexts = [
    "根據 Herman Bavinck (1854-1921) 的神學思想，",
    "Louis Berkhof (1873-1957) 認為",
    "在 [Charles Haddon Spurgeon (1834-1892)] 的講道中",
    "John Calvin (1509-1564) 的教導",
    "Justin Martyr 的觀點"
];

console.log('🧪 測試翻譯功能...\n');

for (const testText of testTexts) {
    console.log(`📝 原始文本: "${testText}"`);
    const translated = scanAndTranslateText(testText, 'zh');
    console.log(`✅ 翻譯結果: "${translated}"`);
    console.log('---');
}

console.log('✅ 翻譯測試完成！'); 