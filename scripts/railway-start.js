#!/usr/bin/env node

/**
 * Railway 優化啟動腳本
 * 減少記憶體使用，避免 SIGTERM 錯誤
 */

console.log('🚀 Railway 優化啟動中...');

// 暫時隱藏 punycode 棄用警告（來自 MongoDB 驅動程式）
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return; // 忽略 punycode 警告
  }
  console.warn(warning.name + ': ' + warning.message);
});

// 設置記憶體限制
const v8 = require('v8');
v8.setFlagsFromString('--max-old-space-size=512');

// 延遲載入重模組
setTimeout(() => {
  console.log('📦 載入應用程式模組...');
  
  // 動態載入 server.js
  require('../server.js');
  
  console.log('✅ 應用程式啟動完成');
}, 1000);

// 優化記憶體使用
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕獲的異常:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

// 定期垃圾回收
setInterval(() => {
  if (global.gc) {
    global.gc();
  }
}, 30000); // 每30秒執行一次垃圾回收 