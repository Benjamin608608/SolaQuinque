#!/usr/bin/env node

/**
 * Railway 開發環境設置檢查腳本
 * 用於驗證開發環境是否正確設置
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironmentVariables() {
    log('\n🔍 檢查環境變數設置...', 'blue');
    
    const requiredVars = [
        'NODE_ENV',
        'OPENAI_API_KEY',
        'VECTOR_STORE_ID',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CALLBACK_URL',
        'SESSION_SECRET',
        'PUBLIC_BASE_URL'
    ];
    
    const optionalVars = [
        'GOOGLE_SITE_VERIFICATION',
        'GA_MEASUREMENT_ID',
        'GOOGLE_SHEETS_SPREADSHEET_ID',
        'GOOGLE_CLIENT_EMAIL',
        'GOOGLE_PRIVATE_KEY'
    ];
    
    let missingRequired = [];
    let presentOptional = [];
    
    log('\n✅ 必要環境變數：', 'green');
    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            const displayValue = varName.includes('SECRET') || varName.includes('KEY') 
                ? '*'.repeat(Math.min(value.length, 20))
                : value.length > 50 
                    ? value.substring(0, 47) + '...'
                    : value;
            log(`  ✓ ${varName}: ${displayValue}`, 'green');
        } else {
            log(`  ✗ ${varName}: 未設置`, 'red');
            missingRequired.push(varName);
        }
    });
    
    log('\n📋 可選環境變數：', 'cyan');
    optionalVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            const displayValue = varName.includes('SECRET') || varName.includes('KEY') 
                ? '*'.repeat(Math.min(value.length, 20))
                : value.length > 50 
                    ? value.substring(0, 47) + '...'
                    : value;
            log(`  ✓ ${varName}: ${displayValue}`, 'cyan');
            presentOptional.push(varName);
        } else {
            log(`  - ${varName}: 未設置`, 'yellow');
        }
    });
    
    return { missingRequired, presentOptional };
}

function validateEnvironmentType() {
    log('\n🌍 檢查環境類型...', 'blue');
    
    const nodeEnv = process.env.NODE_ENV;
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    const baseUrl = process.env.PUBLIC_BASE_URL;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    
    log(`  NODE_ENV: ${nodeEnv}`, nodeEnv === 'development' ? 'green' : 'yellow');
    log(`  Railway 環境: ${isRailway ? '是' : '否'}`, isRailway ? 'green' : 'cyan');
    log(`  基礎 URL: ${baseUrl || '未設置'}`, baseUrl ? 'green' : 'red');
    log(`  回調 URL: ${callbackUrl || '未設置'}`, callbackUrl ? 'green' : 'red');
    
    // 驗證 URL 一致性
    if (baseUrl && callbackUrl) {
        const baseHost = new URL(baseUrl).host;
        const callbackHost = new URL(callbackUrl).host;
        
        if (baseHost === callbackHost) {
            log(`  ✓ URL 主機名一致: ${baseHost}`, 'green');
        } else {
            log(`  ✗ URL 主機名不一致: ${baseHost} vs ${callbackHost}`, 'red');
        }
    }
    
    return {
        nodeEnv,
        isRailway,
        baseUrl,
        callbackUrl,
        isValidDevelopment: nodeEnv === 'development' && baseUrl && callbackUrl
    };
}

function checkGoogleOAuthSetup() {
    log('\n🔑 檢查 Google OAuth 設置...', 'blue');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    
    let issues = [];
    
    if (!clientId) {
        log('  ✗ GOOGLE_CLIENT_ID 未設置', 'red');
        issues.push('CLIENT_ID 缺失');
    } else {
        log('  ✓ GOOGLE_CLIENT_ID 已設置', 'green');
    }
    
    if (!clientSecret) {
        log('  ✗ GOOGLE_CLIENT_SECRET 未設置', 'red');
        issues.push('CLIENT_SECRET 缺失');
    } else {
        log('  ✓ GOOGLE_CLIENT_SECRET 已設置', 'green');
    }
    
    if (!callbackUrl) {
        log('  ✗ GOOGLE_CALLBACK_URL 未設置', 'red');
        issues.push('CALLBACK_URL 缺失');
    } else {
        log(`  ✓ GOOGLE_CALLBACK_URL: ${callbackUrl}`, 'green');
        
        // 檢查 callback URL 格式
        if (callbackUrl.includes('localhost')) {
            log('  ⚠️  使用 localhost，僅適用於本地開發', 'yellow');
        } else if (callbackUrl.includes('railway.app')) {
            log('  ✓ 使用 Railway 域名，適用於雲端部署', 'green');
        } else {
            log('  ⚠️  使用自定義域名', 'yellow');
        }
    }
    
    return { issues, isValid: issues.length === 0 };
}

function displayRailwaySetupInstructions() {
    log('\n📋 Railway 設置說明', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n🚀 如果您還沒有設置 Railway 開發環境：', 'yellow');
    
    log('\n1️⃣ 創建新的 Railway 專案', 'cyan');
    log('  • 前往 https://railway.app', 'reset');
    log('  • 點擊 "New Project"', 'reset');
    log('  • 選擇 "Deploy from GitHub repo"', 'reset');
    log('  • 選擇 Theologian2-6 倉庫', 'reset');
    log('  • 命名為 "Theologian-Development"', 'reset');
    
    log('\n2️⃣ 設置部署分支', 'cyan');
    log('  • 在專案設置中選擇 "development" 分支', 'reset');
    log('  • 確認根目錄設為 "/"', 'reset');
    
    log('\n3️⃣ 設置環境變數', 'cyan');
    log('  • 參考 env.development.example 文件', 'reset');
    log('  • 特別注意設置正確的回調 URL', 'reset');
    
    log('\n4️⃣ 更新 Google OAuth', 'cyan');
    log('  • 在 Google Cloud Console 中添加新的重新導向 URI', 'reset');
    log('  • 格式：https://your-dev-app.railway.app/auth/google/callback', 'reset');
}

function displayTroubleshootingTips() {
    log('\n🔧 故障排除提示', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n❌ 如果遇到問題：', 'yellow');
    
    log('\n🔍 檢查步驟', 'cyan');
    log('  1. 確認所有必要環境變數已設置', 'reset');
    log('  2. 檢查 Railway 部署日誌', 'reset');
    log('  3. 驗證 Google Cloud Console 設置', 'reset');
    log('  4. 等待 10-15 分鐘讓 OAuth 設置生效', 'reset');
    
    log('\n🛠️ 常用命令', 'cyan');
    log('  • npm run check-env - 檢查環境變數', 'green');
    log('  • npm run verify-google - 驗證 Google 設置', 'green');
    log('  • npm run dev:development - 本地開發模式', 'green');
    
    log('\n📝 相關文件', 'cyan');
    log('  • RAILWAY_DEVELOPMENT_SETUP_GUIDE.md - 詳細設置指南', 'green');
    log('  • env.development.example - 環境變數範例', 'green');
}

function generateSetupSummary(envCheck, envType, oauthCheck) {
    log('\n📊 設置狀態總結', 'bright');
    log('='.repeat(50), 'cyan');
    
    const totalRequired = 8; // 必要環境變數數量
    const setRequired = totalRequired - envCheck.missingRequired.length;
    const completionPercentage = Math.round((setRequired / totalRequired) * 100);
    
    log(`\n📈 完成度: ${completionPercentage}% (${setRequired}/${totalRequired})`, 
        completionPercentage >= 100 ? 'green' : completionPercentage >= 70 ? 'yellow' : 'red');
    
    log('\n✅ 狀態檢查:', 'green');
    log(`  環境變數: ${envCheck.missingRequired.length === 0 ? '✓' : '✗'} ${envCheck.missingRequired.length === 0 ? '完整' : `缺少 ${envCheck.missingRequired.length} 個`}`, 
        envCheck.missingRequired.length === 0 ? 'green' : 'red');
    log(`  環境類型: ${envType.isValidDevelopment ? '✓' : '✗'} ${envType.isValidDevelopment ? '開發環境' : '需要調整'}`, 
        envType.isValidDevelopment ? 'green' : 'red');
    log(`  OAuth 設置: ${oauthCheck.isValid ? '✓' : '✗'} ${oauthCheck.isValid ? '正確' : '需要修復'}`, 
        oauthCheck.isValid ? 'green' : 'red');
    
    if (envCheck.missingRequired.length > 0) {
        log('\n❌ 缺少的環境變數:', 'red');
        envCheck.missingRequired.forEach(varName => {
            log(`  • ${varName}`, 'red');
        });
    }
    
    if (oauthCheck.issues.length > 0) {
        log('\n❌ OAuth 問題:', 'red');
        oauthCheck.issues.forEach(issue => {
            log(`  • ${issue}`, 'red');
        });
    }
    
    if (completionPercentage === 100 && envType.isValidDevelopment && oauthCheck.isValid) {
        log('\n🎉 恭喜！開發環境設置完成！', 'green');
        log('您可以開始使用開發環境進行測試了。', 'green');
    } else {
        log('\n⚠️  開發環境設置尚未完成', 'yellow');
        log('請參考上述說明完成設置。', 'yellow');
    }
}

function main() {
    log('🏗️  Railway 開發環境設置檢查工具', 'bright');
    log(''.padEnd(50, '='), 'cyan');
    
    const envCheck = checkEnvironmentVariables();
    const envType = validateEnvironmentType();
    const oauthCheck = checkGoogleOAuthSetup();
    
    generateSetupSummary(envCheck, envType, oauthCheck);
    
    if (envCheck.missingRequired.length > 0 || !envType.isValidDevelopment || !oauthCheck.isValid) {
        displayRailwaySetupInstructions();
        displayTroubleshootingTips();
    }
    
    log('\n🔗 更多資源', 'bright');
    log('  • Railway Dashboard: https://railway.app', 'cyan');
    log('  • Google Cloud Console: https://console.cloud.google.com', 'cyan');
    log('  • 設置指南: RAILWAY_DEVELOPMENT_SETUP_GUIDE.md', 'cyan');
}

if (require.main === module) {
    main();
}

module.exports = {
    checkEnvironmentVariables,
    validateEnvironmentType,
    checkGoogleOAuthSetup
};
