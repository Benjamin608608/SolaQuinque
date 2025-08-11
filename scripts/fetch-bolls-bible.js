const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;
const path = require('path');

// bolls.life API基礎URL
const BOLLS_API_BASE = 'https://bolls.life';

// 聖經書卷資訊 (使用bolls.life的bookId)
const BIBLE_BOOKS = [
  { chinese: '創', english: 'GEN', name: '創世記', bookId: 1 },
  { chinese: '出', english: 'EXO', name: '出埃及記', bookId: 2 },
  { chinese: '利', english: 'LEV', name: '利未記', bookId: 3 },
  { chinese: '民', english: 'NUM', name: '民數記', bookId: 4 },
  { chinese: '申', english: 'DEU', name: '申命記', bookId: 5 },
  { chinese: '書', english: 'JOS', name: '約書亞記', bookId: 6 },
  { chinese: '士', english: 'JDG', name: '士師記', bookId: 7 },
  { chinese: '得', english: 'RUT', name: '路得記', bookId: 8 },
  { chinese: '撒上', english: '1SA', name: '撒母耳記上', bookId: 9 },
  { chinese: '撒下', english: '2SA', name: '撒母耳記下', bookId: 10 },
  { chinese: '王上', english: '1KI', name: '列王紀上', bookId: 11 },
  { chinese: '王下', english: '2KI', name: '列王紀下', bookId: 12 },
  { chinese: '代上', english: '1CH', name: '歷代志上', bookId: 13 },
  { chinese: '代下', english: '2CH', name: '歷代志下', bookId: 14 },
  { chinese: '拉', english: 'EZR', name: '以斯拉記', bookId: 15 },
  { chinese: '尼', english: 'NEH', name: '尼希米記', bookId: 16 },
  { chinese: '斯', english: 'EST', name: '以斯帖記', bookId: 17 },
  { chinese: '伯', english: 'JOB', name: '約伯記', bookId: 18 },
  { chinese: '詩', english: 'PSA', name: '詩篇', bookId: 19 },
  { chinese: '箴', english: 'PRO', name: '箴言', bookId: 20 },
  { chinese: '傳', english: 'ECC', name: '傳道書', bookId: 21 },
  { chinese: '歌', english: 'SNG', name: '雅歌', bookId: 22 },
  { chinese: '賽', english: 'ISA', name: '以賽亞書', bookId: 23 },
  { chinese: '耶', english: 'JER', name: '耶利米書', bookId: 24 },
  { chinese: '哀', english: 'LAM', name: '耶利米哀歌', bookId: 25 },
  { chinese: '結', english: 'EZK', name: '以西結書', bookId: 26 },
  { chinese: '但', english: 'DAN', name: '但以理書', bookId: 27 },
  { chinese: '何', english: 'HOS', name: '何西阿書', bookId: 28 },
  { chinese: '珥', english: 'JOL', name: '約珥書', bookId: 29 },
  { chinese: '摩', english: 'AMO', name: '阿摩司書', bookId: 30 },
  { chinese: '俄', english: 'OBA', name: '俄巴底亞書', bookId: 31 },
  { chinese: '拿', english: 'JON', name: '約拿書', bookId: 32 },
  { chinese: '彌', english: 'MIC', name: '彌迦書', bookId: 33 },
  { chinese: '鴻', english: 'NAM', name: '那鴻書', bookId: 34 },
  { chinese: '哈', english: 'HAB', name: '哈巴谷書', bookId: 35 },
  { chinese: '番', english: 'ZEP', name: '西番雅書', bookId: 36 },
  { chinese: '該', english: 'HAG', name: '哈該書', bookId: 37 },
  { chinese: '亞', english: 'ZEC', name: '撒迦利亞書', bookId: 38 },
  { chinese: '瑪', english: 'MAL', name: '瑪拉基書', bookId: 39 },
  { chinese: '太', english: 'MAT', name: '馬太福音', bookId: 40 },
  { chinese: '可', english: 'MRK', name: '馬可福音', bookId: 41 },
  { chinese: '路', english: 'LUK', name: '路加福音', bookId: 42 },
  { chinese: '約', english: 'JHN', name: '約翰福音', bookId: 43 },
  { chinese: '徒', english: 'ACT', name: '使徒行傳', bookId: 44 },
  { chinese: '羅', english: 'ROM', name: '羅馬書', bookId: 45 },
  { chinese: '林前', english: '1CO', name: '哥林多前書', bookId: 46 },
  { chinese: '林後', english: '2CO', name: '哥林多後書', bookId: 47 },
  { chinese: '加', english: 'GAL', name: '加拉太書', bookId: 48 },
  { chinese: '弗', english: 'EPH', name: '以弗所書', bookId: 49 },
  { chinese: '腓', english: 'PHP', name: '腓立比書', bookId: 50 },
  { chinese: '西', english: 'COL', name: '歌羅西書', bookId: 51 },
  { chinese: '帖前', english: '1TH', name: '帖撒羅尼迦前書', bookId: 52 },
  { chinese: '帖後', english: '2TH', name: '帖撒羅尼迦後書', bookId: 53 },
  { chinese: '提前', english: '1TI', name: '提摩太前書', bookId: 54 },
  { chinese: '提後', english: '2TI', name: '提摩太後書', bookId: 55 },
  { chinese: '多', english: 'TIT', name: '提多書', bookId: 56 },
  { chinese: '門', english: 'PHM', name: '腓利門書', bookId: 57 },
  { chinese: '來', english: 'HEB', name: '希伯來書', bookId: 58 },
  { chinese: '雅', english: 'JAS', name: '雅各書', bookId: 59 },
  { chinese: '彼前', english: '1PE', name: '彼得前書', bookId: 60 },
  { chinese: '彼後', english: '2PE', name: '彼得後書', bookId: 61 },
  { chinese: '約一', english: '1JN', name: '約翰一書', bookId: 62 },
  { chinese: '約二', english: '2JN', name: '約翰二書', bookId: 63 },
  { chinese: '約三', english: '3JN', name: '約翰三書', bookId: 64 },
  { chinese: '猶', english: 'JUD', name: '猶大書', bookId: 65 },
  { chinese: '啟', english: 'REV', name: '啟示錄', bookId: 66 }
];

// 延遲函數
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 獲取單個章節的經文
async function fetchChapter(version, bookId, chapter) {
  try {
    const url = `${BOLLS_API_BASE}/get-text/${version}/${bookId}/${chapter}/`;
    console.log(`正在獲取 ${version} 書卷${bookId} 第${chapter}章...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && Object.keys(data).length > 0) {
      // 將回應轉換為陣列格式
      const verses = Object.values(data).filter(verse => 
        verse && typeof verse === 'object' && verse.verse && verse.text
      );
      
      // 按節數排序
      verses.sort((a, b) => a.verse - b.verse);
      
      console.log(`   ✓ 成功獲取 ${verses.length} 節經文`);
      return verses;
    } else {
      console.log(`未找到 ${version} 書卷${bookId} 第${chapter}章的資料`);
      return [];
    }
  } catch (error) {
    console.error(`獲取 ${version} 書卷${bookId} 第${chapter}章時發生錯誤:`, error.message);
    return [];
  }
}

// 獲取整本書的經文
async function fetchBook(version, book) {
  const bookContent = [];
  let chapter = 1;
  
  while (true) {
    const verses = await fetchChapter(version, book.bookId, chapter);
    
    if (verses.length === 0) {
      break; // 沒有更多章節
    }
    
    // 添加章節標題
    bookContent.push(`\n=== ${book.name} 第${chapter}章 ===\n`);
    
    // 添加經文
    verses.forEach(verse => {
      bookContent.push(`${verse.verse}. ${verse.text}`);
    });
    
    chapter++;
    
    // 延遲以避免API請求過於頻繁
    await delay(500);
  }
  
  return bookContent.join('\n');
}

// 獲取完整聖經
async function fetchBible(version, versionName) {
  console.log(`開始獲取 ${versionName} (${version}) 版本聖經...`);
  
  const bibleContent = [`# ${versionName} 聖經\n\n獲取時間: ${new Date().toLocaleString('zh-TW')}\n`];
  
  for (const book of BIBLE_BOOKS) {
    console.log(`正在處理 ${book.name}...`);
    const bookContent = await fetchBook(version, book);
    
    if (bookContent.trim()) {
      bibleContent.push(`\n# ${book.name}\n`);
      bibleContent.push(bookContent);
    }
    
    // 在書卷之間添加延遲
    await delay(1000);
  }
  
  return bibleContent.join('\n');
}

// 主函數
async function main() {
  try {
    // 創建輸出目錄
    const outputDir = path.join(__dirname, '..', 'data', 'bible-versions');
    await fs.mkdir(outputDir, { recursive: true });
    
    // 獲取CUV版本 (您網站目前使用的版本)
    console.log('=== 開始獲取CUV版本 ===');
    const cuvContent = await fetchBible('CUV', '和合本 (CUV)');
    const cuvPath = path.join(outputDir, 'cuv-bible.txt');
    await fs.writeFile(cuvPath, cuvContent, 'utf8');
    console.log(`CUV版本已保存到: ${cuvPath}`);
    
    // 延遲一下再獲取KJV版本
    await delay(2000);
    
    // 獲取KJV版本
    console.log('=== 開始獲取KJV版本 ===');
    const kjvContent = await fetchBible('KJV', '英王欽定本 (KJV)');
    const kjvPath = path.join(outputDir, 'kjv-bible.txt');
    await fs.writeFile(kjvPath, kjvContent, 'utf8');
    console.log(`KJV版本已保存到: ${kjvPath}`);
    
    // 延遲一下再獲取其他版本
    await delay(2000);
    
    // 獲取UNV版本 (FHL和合本)
    console.log('=== 開始獲取UNV版本 ===');
    const unvContent = await fetchBible('UNV', 'FHL和合本 (UNV)');
    const unvPath = path.join(outputDir, 'unv-bible.txt');
    await fs.writeFile(unvPath, unvContent, 'utf8');
    console.log(`UNV版本已保存到: ${unvPath}`);
    
    console.log('\n=== 完成！ ===');
    console.log(`檔案位置:`);
    console.log(`- CUV: ${cuvPath}`);
    console.log(`- KJV: ${kjvPath}`);
    console.log(`- UNV: ${unvPath}`);
    
  } catch (error) {
    console.error('執行過程中發生錯誤:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  main();
}

module.exports = { fetchBible, fetchBook, fetchChapter }; 