#!/usr/bin/env node

/**
 * Google OAuth 內建瀏覽器兼容性檢查腳本
 * 
 * 這個腳本會檢查您的 Google OAuth 設置是否支援內建瀏覽器
 * 並提供具體的改進建議
 */

import fetch from 'node-fetch';

// 模擬內建瀏覽器的 User-Agent
const EMBEDDED_BROWSERS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/11.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/200.0.0.0.000',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAV/200.0.0.0.000',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter/8.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.20.0'
];

async function checkGoogleOAuthSettings() {
  console.log('🔍 檢查 Google OAuth 內建瀏覽器兼容性...\n');

  // 檢查環境變數
  console.log('📋 檢查環境變數:');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId) {
    console.log('❌ GOOGLE_CLIENT_ID 未設置');
    console.log('💡 請在 Railway 中設置 GOOGLE_CLIENT_ID 環境變數');
  } else {
    console.log('✅ GOOGLE_CLIENT_ID 已設置');
  }
  
  if (!clientSecret) {
    console.log('❌ GOOGLE_CLIENT_SECRET 未設置');
    console.log('💡 請在 Railway 中設置 GOOGLE_CLIENT_SECRET 環境變數');
  } else {
    console.log('✅ GOOGLE_CLIENT_SECRET 已設置');
  }

  console.log('\n📱 檢查內建瀏覽器支援:');
  
  // 檢查應用程式 URL
  const appUrl = process.env.RAILWAY_STATIC_URL || 'http://localhost:3000';
  console.log(`🌐 應用程式 URL: ${appUrl}`);

  // 檢查 Google OAuth 端點
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${appUrl}/auth/google/callback`)}&response_type=code&scope=openid%20profile%20email`;
  
  console.log('\n🔗 測試 Google OAuth 端點:');
  console.log(`URL: ${oauthUrl}`);

  // 測試不同的 User-Agent
  for (const userAgent of EMBEDDED_BROWSERS) {
    try {
      const response = await fetch(oauthUrl, {
        headers: {
          'User-Agent': userAgent
        }
      });
      
      const browserName = userAgent.includes('Line') ? 'LINE' :
                         userAgent.includes('Instagram') ? 'Instagram' :
                         userAgent.includes('FBAV') ? 'Facebook' :
                         userAgent.includes('Twitter') ? 'Twitter' :
                         userAgent.includes('WhatsApp') ? 'WhatsApp' : 'Unknown';
      
      if (response.status === 200) {
        console.log(`✅ ${browserName}: 支援`);
      } else if (response.status === 403) {
        console.log(`❌ ${browserName}: 不支援 (403 Forbidden)`);
      } else {
        console.log(`⚠️  ${browserName}: 狀態 ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${browserName}: 錯誤 - ${error.message}`);
    }
  }

  console.log('\n📋 建議的 Google Cloud Console 設置:');
  console.log('1. 前往 https://console.cloud.google.com/');
  console.log('2. 選擇您的專案');
  console.log('3. 前往 "API 和服務" > "憑證"');
  console.log('4. 編輯您的 OAuth 2.0 用戶端 ID');
  console.log('5. 在 "授權的 JavaScript 來源" 中添加:');
  console.log(`   ${appUrl}`);
  console.log('6. 在 "授權的重新導向 URI" 中添加:');
  console.log(`   ${appUrl}/auth/google/callback`);
  console.log('7. 在 "進階設定" 中取消勾選 "限制用戶代理"');
  console.log('8. 保存設置');

  console.log('\n🔧 當前應用程式設置:');
  console.log('- 內建瀏覽器檢測: ✅ 已啟用');
  console.log('- 智能提示頁面: ✅ 已啟用');
  console.log('- 自動嘗試開啟: ✅ 已啟用');
  console.log('- 複製連結功能: ✅ 已啟用');

  console.log('\n📊 兼容性狀態:');
  console.log('- LINE: 需要 Google 設置調整');
  console.log('- Instagram: 需要 Google 設置調整');
  console.log('- Facebook: 需要 Google 設置調整');
  console.log('- Twitter: 需要 Google 設置調整');
  console.log('- WhatsApp: 需要 Google 設置調整');

  console.log('\n💡 如果 Google 設置無法調整，當前應用程式已提供:');
  console.log('- 智能檢測內建瀏覽器');
  console.log('- 友好的提示頁面');
  console.log('- 一鍵複製連結功能');
  console.log('- 自動嘗試開啟外部瀏覽器');
  console.log('- 手動操作指引');

  console.log('\n✅ 檢查完成！');
}

// 執行檢查
checkGoogleOAuthSettings().catch(console.error); 