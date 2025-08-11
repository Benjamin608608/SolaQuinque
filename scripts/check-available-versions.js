const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 信望愛站API基礎URL
const API_BASE_URL = 'https://bible.fhl.net/json';

// 檢查可用版本
async function checkAvailableVersions() {
  console.log('=== 檢查信望愛站可用的聖經版本 ===\n');
  
  try {
    const response = await fetch(`${API_BASE_URL}/ab.php`);
    const data = await response.json();
    
    if (data.record) {
      console.log(`總共找到 ${data.record_count} 個版本:\n`);
      
      // 分類顯示版本
      const chineseVersions = [];
      const englishVersions = [];
      const otherVersions = [];
      
      data.record.forEach(version => {
        const versionInfo = {
          book: version.book,
          name: version.cname,
          proc: version.proc,
          strong: version.strong,
          ntonly: version.ntonly,
          otonly: version.otonly
        };
        
        // 根據名稱判斷語言
        if (version.cname.includes('和合') || version.cname.includes('中文') || 
            version.cname.includes('繁體') || version.cname.includes('簡體') ||
            version.cname.includes('新譯') || version.cname.includes('現代')) {
          chineseVersions.push(versionInfo);
        } else if (version.cname.includes('English') || version.cname.includes('KJV') || 
                   version.cname.includes('NIV') || version.cname.includes('ESV') ||
                   version.cname.includes('NASB') || version.cname.includes('NKJV')) {
          englishVersions.push(versionInfo);
        } else {
          otherVersions.push(versionInfo);
        }
      });
      
      console.log('=== 中文版本 ===');
      chineseVersions.forEach(v => {
        console.log(`${v.book.padEnd(10)} ${v.name}`);
      });
      
      console.log('\n=== 英文版本 ===');
      englishVersions.forEach(v => {
        console.log(`${v.book.padEnd(10)} ${v.name}`);
      });
      
      console.log('\n=== 其他版本 ===');
      otherVersions.forEach(v => {
        console.log(`${v.book.padEnd(10)} ${v.name}`);
      });
      
      // 查找可能的中文版本
      console.log('\n=== 推薦的中文版本 ===');
      const recommendedChinese = chineseVersions.filter(v => 
        v.name.includes('和合') || v.name.includes('新譯') || v.name.includes('現代')
      );
      
      if (recommendedChinese.length > 0) {
        recommendedChinese.forEach(v => {
          console.log(`建議使用: ${v.book} - ${v.name}`);
        });
      } else {
        console.log('未找到推薦的中文版本');
      }
      
    } else {
      console.log('無法獲取版本列表');
    }
    
  } catch (error) {
    console.error('檢查版本時發生錯誤:', error.message);
  }
}

// 執行檢查
if (require.main === module) {
  checkAvailableVersions();
}

module.exports = { checkAvailableVersions }; 