#!/usr/bin/env node

/**
 * 環境變數檢查腳本
 * 用於診斷 Railway 部署問題
 */

console.log('🔍 環境變數檢查開始...\n');

const requiredEnvVars = [
  'OPENAI_API_KEY',
  'VECTOR_STORE_ID', 
  'SESSION_SECRET'
];

const optionalEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MONGO_URI',
  'NODE_ENV',
  'PORT'
];

console.log('📋 必需環境變數:');
let missingRequired = 0;
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`  ❌ ${varName}: 未設置`);
    missingRequired++;
  }
});

console.log('\n📋 可選環境變數:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`  ⚠️  ${varName}: 未設置`);
  }
});

console.log('\n📊 總結:');
if (missingRequired === 0) {
  console.log('  ✅ 所有必需環境變數已設置');
  console.log('  🚀 應用程式應該可以正常啟動');
} else {
  console.log(`  ❌ 缺少 ${missingRequired} 個必需環境變數`);
  console.log('  🔧 請在 Railway 儀表板中設置缺少的環境變數');
}

console.log('\n💡 部署建議:');
console.log('  1. 確保 OPENAI_API_KEY 有效且有足夠額度');
console.log('  2. 檢查 VECTOR_STORE_ID 是否正確');
console.log('  3. 設置一個強密碼作為 SESSION_SECRET');
console.log('  4. 如需 Google 登入功能，設置 Google OAuth 憑證');

if (process.env.NODE_ENV === 'production') {
  console.log('\n🌐 生產環境檢測:');
  console.log('  ✅ 正在生產環境中運行');
  console.log('  🔒 請確保所有敏感資訊通過環境變數設置');
} else {
  console.log('\n🛠️  開發環境檢測:');
  console.log('  ⚠️  正在開發環境中運行');
  console.log('  💡 建議設置 NODE_ENV=production');
}

console.log('\n🔗 有用的端點:');
console.log('  - 健康檢查: /api/health');
console.log('  - 系統資訊: /api/info');
console.log('  - 作品目錄: /api/catalog'); 