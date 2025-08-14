#!/usr/bin/env node

/**
 * 開發環境設置腳本
 * 用於檢查和指導開發環境的建立
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCurrentEnvironment() {
    log('\n🔍 檢查當前環境...', 'blue');
    
    const nodeEnv = process.env.NODE_ENV || 'development';
    const port = process.env.PORT || '3000';
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    
    log(`  NODE_ENV: ${nodeEnv}`, nodeEnv === 'production' ? 'red' : 'green');
    log(`  PORT: ${port}`, 'cyan');
    log(`  BASE_URL: ${baseUrl}`, 'cyan');
    
    return {
        nodeEnv,
        port,
        baseUrl,
        isProduction: nodeEnv === 'production',
        isRailway: !!process.env.RAILWAY_ENVIRONMENT
    };
}

function displayRailwaySetupGuide() {
    log('\n🚀 Railway 開發環境設置指南', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n📋 步驟 1: 創建新的 Railway 專案', 'yellow');
    log('  1. 前往 https://railway.app', 'reset');
    log('  2. 點擊 "New Project"', 'reset');
    log('  3. 選擇 "Deploy from GitHub repo"', 'reset');
    log('  4. 選擇您的 Theologian2-6 倉庫', 'reset');
    log('  5. 命名為 "Theologian-Dev"', 'reset');
    
    log('\n🔧 步驟 2: 設置環境變數', 'yellow');
    log('  在 Railway 中設置以下環境變數：', 'reset');
    
    const devEnvVars = [
        'NODE_ENV=development',
        'PORT=$PORT',
        'OPENAI_API_KEY=your_openai_api_key',
        'VECTOR_STORE_ID=vs_dev_your_dev_vector_store',
        'GOOGLE_CLIENT_ID=your_dev_google_client_id',
        'GOOGLE_CLIENT_SECRET=your_dev_google_client_secret',
        'GOOGLE_CALLBACK_URL=https://your-dev-app.railway.app/auth/google/callback',
        'SESSION_SECRET=your_dev_session_secret',
        'PUBLIC_BASE_URL=https://your-dev-app.railway.app'
    ];
    
    devEnvVars.forEach(envVar => {
        log(`    ${envVar}`, 'green');
    });
    
    log('\n🔑 步驟 3: Google OAuth 設置', 'yellow');
    log('  1. 前往 Google Cloud Console', 'reset');
    log('  2. 選擇您的專案', 'reset');
    log('  3. 前往 "憑證" 頁面', 'reset');
    log('  4. 編輯現有的 OAuth 憑證或創建新的', 'reset');
    log('  5. 添加授權重新導向 URI：', 'reset');
    log('     https://your-dev-app.railway.app/auth/google/callback', 'green');
    
    log('\n🌿 步驟 4: Git 分支策略', 'yellow');
    log('  建議創建開發分支：', 'reset');
    log('    git checkout -b development', 'green');
    log('    git push -u origin development', 'green');
    log('  在 Railway 中設置自動部署 development 分支', 'reset');
}

function displayLocalDevSetup() {
    log('\n💻 本地開發環境設置', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n📝 創建開發配置文件', 'yellow');
    log('  1. 複製環境變數範例：', 'reset');
    log('     cp env.example .env.development', 'green');
    
    log('\n  2. 編輯 .env.development 文件，設置：', 'reset');
    const localEnvVars = [
        'NODE_ENV=development',
        'PORT=3001',
        'PUBLIC_BASE_URL=http://localhost:3001',
        'GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback'
    ];
    
    localEnvVars.forEach(envVar => {
        log(`     ${envVar}`, 'green');
    });
    
    log('\n🔧 運行開發環境', 'yellow');
    log('  npm run dev', 'green');
    log('  或者：nodemon server.js', 'green');
}

function displayBestPractices() {
    log('\n✨ 開發環境最佳實踐', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n🔄 部署流程', 'yellow');
    log('  1. 本地開發和測試', 'reset');
    log('  2. 推送到 development 分支', 'reset');
    log('  3. 在開發環境中驗證', 'reset');
    log('  4. 合併到 main 分支', 'reset');
    log('  5. 部署到正式環境', 'reset');
    
    log('\n🛡️ 資料隔離', 'yellow');
    log('  • 使用不同的向量庫 ID', 'reset');
    log('  • 使用不同的 Google OAuth 憑證', 'reset');
    log('  • 設置開發環境專用的資料庫', 'reset');
    log('  • 在 UI 中標示開發環境', 'reset');
    
    log('\n💰 成本控制', 'yellow');
    log('  • 設置較低的資源限制', 'reset');
    log('  • 使用較小的測試資料集', 'reset');
    log('  • 監控 API 使用量', 'reset');
    log('  • 定期清理不需要的資源', 'reset');
}

function displayEnvironmentComparison() {
    log('\n📊 環境對比', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n🎯 正式環境 vs 開發環境', 'yellow');
    
    const comparison = [
        ['用途', '正式用戶使用', '開發測試'],
        ['域名', 'theologian-production.railway.app', 'theologian-dev.railway.app'],
        ['分支', 'main', 'development'],
        ['資料', '正式資料', '測試資料'],
        ['監控', '全面監控', '開發監控'],
        ['資源', '高性能配置', '基本配置']
    ];
    
    log('  ┌──────────┬──────────────────────────┬──────────────────────────┐', 'cyan');
    log('  │   項目   │        正式環境          │        開發環境          │', 'cyan');
    log('  ├──────────┼──────────────────────────┼──────────────────────────┤', 'cyan');
    
    comparison.forEach(([item, prod, dev]) => {
        log(`  │${item.padEnd(10)}│${prod.padEnd(26)}│${dev.padEnd(26)}│`, 'cyan');
    });
    
    log('  └──────────┴──────────────────────────┴──────────────────────────┘', 'cyan');
}

function main() {
    log('🏗️  Theologian 開發環境設置工具', 'bright');
    log(''.padEnd(50, '='), 'cyan');
    
    const env = checkCurrentEnvironment();
    
    if (env.isRailway && env.isProduction) {
        log('\n⚠️  您當前在 Railway 正式環境中！', 'red');
        log('   建議在本地運行此腳本來設置開發環境', 'yellow');
    }
    
    displayEnvironmentComparison();
    displayRailwaySetupGuide();
    displayLocalDevSetup();
    displayBestPractices();
    
    log('\n🎉 設置完成後的驗證步驟', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n✅ 檢查清單', 'yellow');
    const checklist = [
        '□ Railway 開發專案已創建',
        '□ 環境變數已設置',
        '□ Google OAuth 已配置',
        '□ 開發分支已創建',
        '□ 本地開發環境可運行',
        '□ 開發環境可正常訪問',
        '□ Google 登入功能正常',
        '□ API 功能正常'
    ];
    
    checklist.forEach(item => {
        log(`  ${item}`, 'green');
    });
    
    log('\n🔗 相關文件', 'yellow');
    log('  • DEVELOPMENT_ENVIRONMENT_SETUP.md - 詳細設置指南', 'cyan');
    log('  • env.example - 環境變數範例', 'cyan');
    log('  • railway.toml - Railway 配置', 'cyan');
    
    log('\n📞 需要幫助？', 'yellow');
    log('  • 檢查環境變數：npm run check-env', 'cyan');
    log('  • 驗證 Google 設置：npm run verify-google', 'cyan');
    log('  • 驗證部署：npm run verify-deployment', 'cyan');
    
    log('\n🚀 開始開發！', 'bright');
    log('   祝您開發順利！', 'green');
}

if (require.main === module) {
    main();
}

module.exports = {
    checkCurrentEnvironment,
    displayRailwaySetupGuide,
    displayLocalDevSetup,
    displayBestPractices
};
