#!/usr/bin/env node

/**
 * Google OAuth 配置檢查腳本
 * 專門用於診斷 Google 登入問題
 */

console.log('🔐 Google OAuth 配置檢查\n');

// 檢查 Google OAuth 相關環境變數
const googleOAuthVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL'
];

console.log('🔍 檢查 Google OAuth 環境變數:');
let missingCount = 0;

googleOAuthVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== 'your_google_client_id_here' && value !== 'your_google_client_secret_here') {
    console.log(`  ✅ ${varName}: 已設置`);
  } else {
    console.log(`  ❌ ${varName}: 未設置或使用預設值`);
    missingCount++;
  }
});

console.log('\n📊 診斷結果:');

if (missingCount === 0) {
  console.log('  ✅ Google OAuth 環境變數已正確設置');
  console.log('  🚀 Google 登入功能應該可以正常使用');
  
  // 檢查回調 URL 格式
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
  if (callbackUrl && !callbackUrl.includes('railway.app')) {
    console.log('  ⚠️  警告: 回調 URL 可能不是 Railway 域名');
    console.log(`    當前設置: ${callbackUrl}`);
    console.log('    建議格式: https://your-app-name.railway.app/auth/google/callback');
  }
} else {
  console.log(`  ❌ 缺少 ${missingCount} 個 Google OAuth 環境變數`);
  console.log('  🚨 這就是 Google 登入出現 "Not Found" 錯誤的原因！');
}

console.log('\n🔧 立即修復步驟:');

if (missingCount > 0) {
  console.log('  1. 前往 Google Cloud Console (console.cloud.google.com)');
  console.log('  2. 創建 OAuth 2.0 憑證');
  console.log('  3. 在 Railway 儀表板中添加環境變數:');
  console.log('');
  console.log('     GOOGLE_CLIENT_ID=your-google-client-id');
  console.log('     GOOGLE_CLIENT_SECRET=your-google-client-secret');
  console.log('     GOOGLE_CALLBACK_URL=https://your-app-name.railway.app/auth/google/callback');
  console.log('');
  console.log('  4. 等待 Railway 自動重新部署');
  console.log('  5. 測試 Google 登入功能');
}

console.log('\n💡 Google OAuth 設置指南:');
console.log('  1. 參考 scripts/setup-google-oauth.md 文件');
console.log('  2. 確保 Google+ API 已啟用');
console.log('  3. 檢查授權的重新導向 URI 設置');

console.log('\n🔗 有用的測試端點:');
console.log('  - Google 登入: /auth/google');
console.log('  - 健康檢查: /api/health');
console.log('  - 系統資訊: /api/info');

console.log('\n⚠️  重要提醒:');
console.log('  - 設置環境變數後，Railway 會自動重新部署');
console.log('  - 請等待 1-2 分鐘讓部署完成');
console.log('  - 首次設置可能需要幾分鐘才能生效');

if (process.env.NODE_ENV === 'production') {
  console.log('\n🌐 檢測到生產環境');
  console.log('  ✅ 適合設置 Google OAuth');
} else {
  console.log('\n🛠️  檢測到開發環境');
  console.log('  💡 建議在 Railway 生產環境中設置');
}

console.log('\n📋 替代方案:');
console.log('  如果暫時不需要 Google 登入，可以:');
console.log('  1. 修改前端代碼隱藏登入按鈕');
console.log('  2. 設置基本認證系統');
console.log('  3. 跳過認證直接使用應用程式'); 