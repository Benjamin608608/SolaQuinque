#!/usr/bin/env node

/**
 * Google OAuth 設置驗證腳本
 * 用於驗證 Google 登入設置是否正確
 */

console.log('🔐 Google OAuth 設置驗證\n');

// 檢查所有相關環境變數
const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'SESSION_SECRET'
];

console.log('🔍 檢查必需環境變數:');
let allSet = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value && 
      value !== 'your_google_client_id_here' && 
      value !== 'your_google_client_secret_here' &&
      value !== 'your_session_secret_here') {
    console.log(`  ✅ ${varName}: 已設置`);
  } else {
    console.log(`  ❌ ${varName}: 未設置或使用預設值`);
    allSet = false;
  }
});

console.log('\n📊 驗證結果:');

if (allSet) {
  console.log('  ✅ 所有 Google OAuth 環境變數已正確設置');
  console.log('  🚀 Google 登入功能應該可以正常使用');
  
  // 檢查回調 URL 格式
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
  if (callbackUrl) {
    if (callbackUrl.includes('railway.app')) {
      console.log('  ✅ 回調 URL 格式正確');
    } else {
      console.log('  ⚠️  警告: 回調 URL 可能不是 Railway 域名');
      console.log(`    當前設置: ${callbackUrl}`);
    }
  }
  
  console.log('\n🎉 恭喜！Google OAuth 設置完成');
  console.log('  現在您可以:');
  console.log('  1. 重新部署應用程式');
  console.log('  2. 測試 Google 登入功能');
  console.log('  3. 享受完整的用戶認證體驗');
  
} else {
  console.log('  ❌ 還有環境變數未設置');
  console.log('  🔧 請完成以下步驟:');
  console.log('');
  console.log('  1. 前往 Google Cloud Console 創建 OAuth 憑證');
  console.log('  2. 在 Railway 儀表板中設置環境變數');
  console.log('  3. 確保回調 URL 使用正確的 Railway 域名');
  console.log('  4. 重新部署應用程式');
}

console.log('\n🔗 有用的測試端點:');
console.log('  - Google 登入: /auth/google');
console.log('  - 健康檢查: /api/health');
console.log('  - 系統資訊: /api/info');

console.log('\n📋 下一步:');
if (allSet) {
  console.log('  1. 等待 Railway 自動重新部署');
  console.log('  2. 訪問您的應用程式');
  console.log('  3. 點擊 "使用 Google 登入" 按鈕');
  console.log('  4. 完成 Google 登入流程');
} else {
  console.log('  1. 完成環境變數設置');
  console.log('  2. 參考 scripts/setup-google-oauth.md');
  console.log('  3. 重新運行此驗證腳本');
}

console.log('\n⚠️  重要提醒:');
console.log('  - 設置環境變數後，Railway 會自動重新部署');
console.log('  - 請等待 1-2 分鐘讓部署完成');
console.log('  - 首次設置可能需要幾分鐘才能生效');
console.log('  - 確保 Google Cloud Console 中的重新導向 URI 設置正確'); 