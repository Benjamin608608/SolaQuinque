#!/usr/bin/env node

/**
 * redirect_uri_mismatch 錯誤診斷腳本
 * 專門用於解決 Google OAuth 重新導向 URI 不匹配問題
 */

console.log('🔍 redirect_uri_mismatch 錯誤診斷\n');

console.log('📋 問題分析:');
console.log('  錯誤 400: redirect_uri_mismatch 表示');
console.log('  Google Cloud Console 中的重新導向 URI');
console.log('  與應用程式實際發送的 URI 不匹配\n');

console.log('🔧 立即修復步驟:\n');

console.log('1. 前往 Google Cloud Console');
console.log('   - 訪問: https://console.cloud.google.com');
console.log('   - 選擇您的專案\n');

console.log('2. 檢查 OAuth 憑證設置');
console.log('   - 前往 "API 和服務" > "憑證"');
console.log('   - 找到您的 OAuth 2.0 用戶端 ID');
console.log('   - 點擊編輯（鉛筆圖示）\n');

console.log('3. 更新授權的重新導向 URI');
console.log('   - 確保設置為:');
console.log('     https://theologian2-production.up.railway.app/auth/google/callback');
console.log('   - 注意：必須完全匹配，包括 https:// 和結尾的 /auth/google/callback\n');

console.log('4. 保存更改');
console.log('   - 點擊 "保存"');
console.log('   - 等待幾分鐘讓更改生效\n');

console.log('5. 測試登入');
console.log('   - 重新訪問您的應用程式');
console.log('   - 再次嘗試 Google 登入\n');

console.log('🚨 常見問題:');
console.log('  ❌ 缺少 https:// 前綴');
console.log('  ❌ 缺少 /auth/google/callback 後綴');
console.log('  ❌ 域名拼寫錯誤');
console.log('  ❌ 有多個不正確的重新導向 URI');
console.log('  ❌ 使用了 localhost 或開發環境 URL\n');

console.log('✅ 正確的重新導向 URI 範例:');
console.log('   https://theologian2-production.up.railway.app/auth/google/callback\n');

console.log('🔍 驗證步驟:');
console.log('  1. 在 Google Cloud Console 中確認重新導向 URI');
console.log('  2. 在 Railway 中確認 GOOGLE_CALLBACK_URL 環境變數');
console.log('  3. 確保兩者完全一致');
console.log('  4. 等待幾分鐘讓更改生效');
console.log('  5. 清除瀏覽器快取並重新測試\n');

console.log('⚠️  重要提醒:');
console.log('  - Google OAuth 設置更改可能需要幾分鐘才能生效');
console.log('  - 確保沒有多餘的空格或特殊字符');
console.log('  - 檢查是否有大小寫差異');
console.log('  - 清除瀏覽器快取可能有幫助');

console.log('\n📞 如果問題持續:');
console.log('  1. 檢查 Railway 日誌中的錯誤訊息');
console.log('  2. 確認應用程式已重新部署');
console.log('  3. 嘗試使用無痕模式測試');
console.log('  4. 檢查是否有防火牆或代理設置影響'); 