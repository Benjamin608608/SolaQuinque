const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;
const path = require('path');

// 信望愛站API基礎URL
const API_BASE_URL = 'https://bible.fhl.net/json';

// 聖經書卷資訊
const BIBLE_BOOKS = [
  { chinese: '創', english: 'GEN', name: '創世記' },
  { chinese: '出', english: 'EXO', name: '出埃及記' },
  { chinese: '利', english: 'LEV', name: '利未記' },
  { chinese: '民', english: 'NUM', name: '民數記' },
  { chinese: '申', english: 'DEU', name: '申命記' },
  { chinese: '書', english: 'JOS', name: '約書亞記' },
  { chinese: '士', english: 'JDG', name: '士師記' },
  { chinese: '得', english: 'RUT', name: '路得記' },
  { chinese: '撒上', english: '1SA', name: '撒母耳記上' },
  { chinese: '撒下', english: '2SA', name: '撒母耳記下' },
  { chinese: '王上', english: '1KI', name: '列王紀上' },
  { chinese: '王下', english: '2KI', name: '列王紀下' },
  { chinese: '代上', english: '1CH', name: '歷代志上' },
  { chinese: '代下', english: '2CH', name: '歷代志下' },
  { chinese: '拉', english: 'EZR', name: '以斯拉記' },
  { chinese: '尼', english: 'NEH', name: '尼希米記' },
  { chinese: '斯', english: 'EST', name: '以斯帖記' },
  { chinese: '伯', english: 'JOB', name: '約伯記' },
  { chinese: '詩', english: 'PSA', name: '詩篇' },
  { chinese: '箴', english: 'PRO', name: '箴言' },
  { chinese: '傳', english: 'ECC', name: '傳道書' },
  { chinese: '歌', english: 'SNG', name: '雅歌' },
  { chinese: '賽', english: 'ISA', name: '以賽亞書' },
  { chinese: '耶', english: 'JER', name: '耶利米書' },
  { chinese: '哀', english: 'LAM', name: '耶利米哀歌' },
  { chinese: '結', english: 'EZK', name: '以西結書' },
  { chinese: '但', english: 'DAN', name: '但以理書' },
  { chinese: '何', english: 'HOS', name: '何西阿書' },
  { chinese: '珥', english: 'JOL', name: '約珥書' },
  { chinese: '摩', english: 'AMO', name: '阿摩司書' },
  { chinese: '俄', english: 'OBA', name: '俄巴底亞書' },
  { chinese: '拿', english: 'JON', name: '約拿書' },
  { chinese: '彌', english: 'MIC', name: '彌迦書' },
  { chinese: '鴻', english: 'NAM', name: '那鴻書' },
  { chinese: '哈', english: 'HAB', name: '哈巴谷書' },
  { chinese: '番', english: 'ZEP', name: '西番雅書' },
  { chinese: '該', english: 'HAG', name: '哈該書' },
  { chinese: '亞', english: 'ZEC', name: '撒迦利亞書' },
  { chinese: '瑪', english: 'MAL', name: '瑪拉基書' },
  { chinese: '太', english: 'MAT', name: '馬太福音' },
  { chinese: '可', english: 'MRK', name: '馬可福音' },
  { chinese: '路', english: 'LUK', name: '路加福音' },
  { chinese: '約', english: 'JHN', name: '約翰福音' },
  { chinese: '徒', english: 'ACT', name: '使徒行傳' },
  { chinese: '羅', english: 'ROM', name: '羅馬書' },
  { chinese: '林前', english: '1CO', name: '哥林多前書' },
  { chinese: '林後', english: '2CO', name: '哥林多後書' },
  { chinese: '加', english: 'GAL', name: '加拉太書' },
  { chinese: '弗', english: 'EPH', name: '以弗所書' },
  { chinese: '腓', english: 'PHP', name: '腓立比書' },
  { chinese: '西', english: 'COL', name: '歌羅西書' },
  { chinese: '帖前', english: '1TH', name: '帖撒羅尼迦前書' },
  { chinese: '帖後', english: '2TH', name: '帖撒羅尼迦後書' },
  { chinese: '提前', english: '1TI', name: '提摩太前書' },
  { chinese: '提後', english: '2TI', name: '提摩太後書' },
  { chinese: '多', english: 'TIT', name: '提多書' },
  { chinese: '門', english: 'PHM', name: '腓利門書' },
  { chinese: '來', english: 'HEB', name: '希伯來書' },
  { chinese: '雅', english: 'JAS', name: '雅各書' },
  { chinese: '彼前', english: '1PE', name: '彼得前書' },
  { chinese: '彼後', english: '2PE', name: '彼得後書' },
  { chinese: '約一', english: '1JN', name: '約翰一書' },
  { chinese: '約二', english: '2JN', name: '約翰二書' },
  { chinese: '約三', english: '3JN', name: '約翰三書' },
  { chinese: '猶', english: 'JUD', name: '猶大書' },
  { chinese: '啟', english: 'REV', name: '啟示錄' }
];

// 延遲函數，避免API請求過於頻繁
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 獲取單個章節的經文
async function fetchChapter(version, bookChinese, chapter) {
  try {
    const url = `${API_BASE_URL}/qb.php?chineses=${bookChinese}&chap=${chapter}&version=${version}&strong=0&gb=0`;
    console.log(`正在獲取 ${version} ${bookChinese} ${chapter}章...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success' && data.record && data.record.length > 0) {
      return data.record;
    } else {
      console.log(`未找到 ${version} ${bookChinese} ${chapter}章的資料`);
      return [];
    }
  } catch (error) {
    console.error(`獲取 ${version} ${bookChinese} ${chapter}章時發生錯誤:`, error.message);
    return [];
  }
}

// 獲取整本書的經文
async function fetchBook(version, book) {
  const bookContent = [];
  let chapter = 1;
  
  while (true) {
    const verses = await fetchChapter(version, book.chinese, chapter);
    
    if (verses.length === 0) {
      break; // 沒有更多章節
    }
    
    // 添加章節標題
    bookContent.push(`\n=== ${book.name} 第${chapter}章 ===\n`);
    
    // 添加經文
    verses.forEach(verse => {
      bookContent.push(`${verse.sec}. ${verse.bible_text}`);
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
    
    // 獲取中文和合本版本
    console.log('=== 開始獲取FHL和合本版本 ===');
    const unvContent = await fetchBible('unv', 'FHL和合本 (UNV)');
    const unvPath = path.join(outputDir, 'unv-bible.txt');
    await fs.writeFile(unvPath, unvContent, 'utf8');
    console.log(`FHL和合本版本已保存到: ${unvPath}`);
    
    // 延遲一下再獲取和合本2010版本
    await delay(2000);
    
    console.log('=== 開始獲取和合本2010版本 ===');
    const rcuvContent = await fetchBible('rcuv', '和合本2010 (RCUV)');
    const rcuvPath = path.join(outputDir, 'rcuv-bible.txt');
    await fs.writeFile(rcuvPath, rcuvContent, 'utf8');
    console.log(`和合本2010版本已保存到: ${rcuvPath}`);
    
    // 延遲一下再獲取KJV版本
    await delay(2000);
    
    // 獲取KJV版本
    console.log('=== 開始獲取KJV版本 ===');
    const kjvContent = await fetchBible('kjv', '英王欽定本 (KJV)');
    const kjvPath = path.join(outputDir, 'kjv-bible.txt');
    await fs.writeFile(kjvPath, kjvContent, 'utf8');
    console.log(`KJV版本已保存到: ${kjvPath}`);
    
    console.log('\n=== 完成！ ===');
    console.log(`檔案位置:`);
    console.log(`- FHL和合本: ${unvPath}`);
    console.log(`- 和合本2010: ${rcuvPath}`);
    console.log(`- KJV: ${kjvPath}`);
    
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