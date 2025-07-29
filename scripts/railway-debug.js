#!/usr/bin/env node

/**
 * Railway 部署診斷腳本
 * 專門用於診斷 Railway "Not Found" 錯誤
 */

console.log('🚂 Railway 部署診斷工具\n');

// 檢查關鍵環境變數
const criticalVars = [
  'OPENAI_API_KEY',
  'VECTOR_STORE_ID', 
  'SESSION_SECRET'
];

console.log('🔍 檢查關鍵環境變數:');
let missingCount = 0;

criticalVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== 'your_openai_api_key_here' && value !== 'vs_6886f711eda0819189b6c017d6b96d23' && value !== 'your_session_secret_here') {
    console.log(`  ✅ ${varName}: 已設置`);
  } else {
    console.log(`  ❌ ${varName}: 未設置或使用預設值`);
    missingCount++;
  }
});

console.log('\n📊 診斷結果:');

if (missingCount === 0) {
  console.log('  ✅ 所有關鍵環境變數已正確設置');
  console.log('  🚀 應用程式應該可以正常啟動');
} else {
  console.log(`  ❌ 缺少 ${missingCount} 個關鍵環境變數`);
  console.log('  🚨 這就是 Railway "Not Found" 錯誤的原因！');
}

console.log('\n🔧 立即修復步驟:');

if (missingCount > 0) {
  console.log('  1. 前往 Railway 儀表板 (railway.app)');
  console.log('  2. 選擇您的專案');
  console.log('  3. 點擊 "Variables" 標籤');
  console.log('  4. 添加以下環境變數:');
  console.log('');
  console.log('     OPENAI_API_KEY=sk-your-actual-openai-key');
  console.log('     VECTOR_STORE_ID=vs_6886f711eda0819189b6c017d6b96d23');
  console.log('     SESSION_SECRET=your-super-secret-key-here');
  console.log('     NODE_ENV=production');
  console.log('');
  console.log('  5. 等待 Railway 自動重新部署');
  console.log('  6. 檢查 /api/health 端點');
}

console.log('\n💡 獲取 OpenAI API 金鑰:');
console.log('  1. 前往 https://platform.openai.com/api-keys');
console.log('  2. 登入您的 OpenAI 帳戶');
console.log('  3. 點擊 "Create new secret key"');
console.log('  4. 複製生成的 API 金鑰');

console.log('\n🔗 有用的檢查端點:');
console.log('  - 健康檢查: https://your-app.railway.app/api/health');
console.log('  - 系統資訊: https://your-app.railway.app/api/info');

console.log('\n⚠️  重要提醒:');
console.log('  - 設置環境變數後，Railway 會自動重新部署');
console.log('  - 請等待 1-2 分鐘讓部署完成');
console.log('  - 如果仍然有問題，請檢查 Railway 日誌');

if (process.env.NODE_ENV === 'production') {
  console.log('\n🌐 檢測到生產環境');
} else {
  console.log('\n🛠️  檢測到開發環境');
  console.log('  💡 在 Railway 上會自動設置為 production');
} 