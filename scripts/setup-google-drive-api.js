#!/usr/bin/env node

/**
 * Google Drive API 設置腳本
 * 
 * 此腳本將幫助您設置 Google Drive API 密鑰
 * 用於下載神學文件並生成向量資料
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

async function setupGoogleDriveAPI() {
    console.log('🔧 Google Drive API 設置工具');
    console.log('============================');
    
    console.log('\n📋 您需要設置 Google Drive API 密鑰來下載神學文件');
    console.log('📁 目標：下載 1321 個神學文件並生成本地向量資料');
    
    console.log('\n🚀 快速設置步驟：');
    console.log('\n1. 前往 Google Cloud Console');
    console.log('   https://console.cloud.google.com/');
    
    console.log('\n2. 創建新專案或選擇現有專案');
    console.log('   - 點擊頂部的專案選擇器');
    console.log('   - 選擇現有專案或創建新專案');
    
    console.log('\n3. 啟用 Google Drive API');
    console.log('   - 在左側選單中選擇「API 和服務」→「程式庫」');
    console.log('   - 搜尋「Google Drive API」');
    console.log('   - 點擊「Google Drive API」並啟用');
    
    console.log('\n4. 創建 API 金鑰');
    console.log('   - 在左側選單中選擇「API 和服務」→「憑證」');
    console.log('   - 點擊「建立憑證」→「API 金鑰」');
    console.log('   - 複製生成的 API 金鑰（格式：AIzaSyC...）');
    
    console.log('\n5. 更新 .env 文件');
    console.log('   在您的 .env 文件中添加：');
    console.log('   GOOGLE_DRIVE_API_KEY=your_api_key_here');
    
    console.log('\n📁 您的神學資料夾：');
    console.log('https://drive.google.com/drive/folders/1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K');
    
    console.log('\n📊 預期結果：');
    console.log('- 下載 1321 個神學文件');
    console.log('- 生成向量嵌入');
    console.log('- 保存到本地 data/local-vectors/ 目錄');
    console.log('- 享受 10-30 倍的速度提升');
    
    console.log('\n🎯 設置完成後，運行：');
    console.log('node scripts/create-local-vectors.js');
    
    console.log('\n📖 詳細指南：');
    console.log('請參考 scripts/setup-google-api-key.md');
    
    // 檢查當前設置
    console.log('\n🔍 當前設置檢查：');
    
    if (process.env.GOOGLE_DRIVE_API_KEY && process.env.GOOGLE_DRIVE_API_KEY !== 'your_google_drive_api_key_here') {
        console.log('✅ GOOGLE_DRIVE_API_KEY: 已設置');
    } else {
        console.log('❌ GOOGLE_DRIVE_API_KEY: 未設置');
    }
    
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        console.log('✅ OPENAI_API_KEY: 已設置');
    } else {
        console.log('❌ OPENAI_API_KEY: 未設置');
    }
    
    console.log('\n💡 提示：');
    console.log('- API 金鑰格式應該以 AIzaSy 開頭');
    console.log('- 確保 Google Drive API 已啟用');
    console.log('- 確保您有權限訪問神學資料夾');
}

if (require.main === module) {
    setupGoogleDriveAPI();
}

module.exports = { setupGoogleDriveAPI }; 