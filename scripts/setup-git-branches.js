#!/usr/bin/env node

/**
 * Git 分支設置腳本
 * 用於在同一個倉庫中設置開發和正式環境分支
 */

const { execSync } = require('child_process');
const fs = require('fs');

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

function runCommand(command, description) {
    try {
        log(`\n🔧 ${description}...`, 'blue');
        log(`   執行: ${command}`, 'cyan');
        const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        log(`   ✅ 成功`, 'green');
        return result;
    } catch (error) {
        log(`   ❌ 錯誤: ${error.message}`, 'red');
        return null;
    }
}

function getCurrentBranch() {
    try {
        return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
        log('❌ 無法獲取當前分支', 'red');
        return null;
    }
}

function checkGitStatus() {
    try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        return status.trim() === '';
    } catch (error) {
        return false;
    }
}

function setupBranches() {
    log('🌿 設置 Git 分支結構', 'bright');
    log('='.repeat(50), 'cyan');
    
    const currentBranch = getCurrentBranch();
    log(`\n📍 當前分支: ${currentBranch}`, 'cyan');
    
    // 檢查工作目錄是否乾淨
    if (!checkGitStatus()) {
        log('\n⚠️  工作目錄有未提交的更改', 'yellow');
        log('   建議先提交或儲存更改：', 'reset');
        log('   git add .', 'green');
        log('   git commit -m "準備設置開發環境"', 'green');
        log('   或者: git stash', 'green');
        return;
    }
    
    // 確保我們在 main 分支
    if (currentBranch !== 'main') {
        runCommand('git checkout main', '切換到 main 分支');
    }
    
    // 拉取最新更改
    runCommand('git pull origin main', '拉取最新的 main 分支');
    
    // 創建並切換到 development 分支
    const createDevResult = runCommand('git checkout -b development', '創建 development 分支');
    
    if (createDevResult !== null) {
        // 推送 development 分支到遠程
        runCommand('git push -u origin development', '推送 development 分支到遠程');
        
        log('\n✅ 分支設置完成！', 'bright');
        log('\n📋 分支結構：', 'yellow');
        log('  • main        - 正式環境（Railway 自動部署）', 'green');
        log('  • development - 開發環境（Railway 自動部署）', 'green');
        
        displayBranchWorkflow();
    }
}

function displayBranchWorkflow() {
    log('\n🔄 建議的工作流程', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n1️⃣ 開發新功能', 'yellow');
    log('   git checkout development', 'green');
    log('   git pull origin development', 'green');
    log('   # 進行開發...', 'cyan');
    log('   git add .', 'green');
    log('   git commit -m "新功能: 描述"', 'green');
    log('   git push origin development', 'green');
    
    log('\n2️⃣ 測試通過後合併到正式環境', 'yellow');
    log('   git checkout main', 'green');
    log('   git pull origin main', 'green');
    log('   git merge development', 'green');
    log('   git push origin main', 'green');
    
    log('\n3️⃣ Railway 自動部署設置', 'yellow');
    log('   • 正式環境：監聽 main 分支', 'cyan');
    log('   • 開發環境：監聽 development 分支', 'cyan');
}

function displayRailwaySetup() {
    log('\n🚀 Railway 雙環境設置', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n📋 設置步驟：', 'yellow');
    
    log('\n1️⃣ 正式環境（已存在）', 'yellow');
    log('   • 專案名稱: Theologian2-Production', 'cyan');
    log('   • 部署分支: main', 'cyan');
    log('   • 域名: theologian2-production.railway.app', 'cyan');
    
    log('\n2️⃣ 開發環境（新建）', 'yellow');
    log('   • 前往 Railway Dashboard', 'cyan');
    log('   • 點擊 "New Project"', 'cyan');
    log('   • 選擇 "Deploy from GitHub repo"', 'cyan');
    log('   • 選擇相同的 Theologian2-6 倉庫', 'cyan');
    log('   • 專案名稱: Theologian2-Development', 'cyan');
    log('   • 在 Settings > Source 中設置：', 'cyan');
    log('     - Branch: development', 'green');
    log('     - Root Directory: / (根目錄)', 'green');
    
    log('\n3️⃣ 環境變數設置', 'yellow');
    log('   在開發環境中設置不同的環境變數：', 'cyan');
    
    const envVars = [
        { key: 'NODE_ENV', prod: 'production', dev: 'development' },
        { key: 'VECTOR_STORE_ID', prod: 'vs_prod_xxx', dev: 'vs_dev_xxx' },
        { key: 'GOOGLE_CALLBACK_URL', prod: 'https://theologian2-production.railway.app/auth/google/callback', dev: 'https://theologian2-development.railway.app/auth/google/callback' },
        { key: 'PUBLIC_BASE_URL', prod: 'https://theologian2-production.railway.app', dev: 'https://theologian2-development.railway.app' }
    ];
    
    log('\n   ┌─────────────────────┬────────────────────────────────┬────────────────────────────────┐', 'cyan');
    log('   │      環境變數       │             正式環境            │             開發環境            │', 'cyan');
    log('   ├─────────────────────┼────────────────────────────────┼────────────────────────────────┤', 'cyan');
    
    envVars.forEach(({ key, prod, dev }) => {
        const keyPadded = key.padEnd(19);
        const prodPadded = prod.length > 30 ? prod.substring(0, 27) + '...' : prod.padEnd(30);
        const devPadded = dev.length > 30 ? dev.substring(0, 27) + '...' : dev.padEnd(30);
        log(`   │ ${keyPadded} │ ${prodPadded} │ ${devPadded} │`, 'cyan');
    });
    
    log('   └─────────────────────┴────────────────────────────────┴────────────────────────────────┘', 'cyan');
}

function createDevEnvironmentFile() {
    log('\n📄 創建開發環境配置文件...', 'blue');
    
    const devEnvContent = `# 開發環境配置文件
# 此文件用於本地開發環境

# 基本配置
NODE_ENV=development
PORT=3001

# OpenAI API (可以使用相同的 API Key)
OPENAI_API_KEY=your_openai_api_key_here

# 開發環境專用向量庫 (建議使用不同的)
VECTOR_STORE_ID=vs_dev_your_dev_vector_store_id

# Google OAuth (開發環境專用)
GOOGLE_CLIENT_ID=your_dev_google_client_id
GOOGLE_CLIENT_SECRET=your_dev_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Session 配置
SESSION_SECRET=your_dev_session_secret

# 開發環境 URL
PUBLIC_BASE_URL=http://localhost:3001

# 開發環境 SEO 設置 (可選)
GOOGLE_SITE_VERIFICATION=dev_verification_token
GA_MEASUREMENT_ID=G-DEV-TRACKING-ID

# 開發環境 Google Sheets (可選)
GOOGLE_SHEETS_SPREADSHEET_ID=dev_spreadsheet_id
GOOGLE_CLIENT_EMAIL=dev-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nDEV_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n"
`;

    try {
        fs.writeFileSync('.env.development', devEnvContent);
        log('   ✅ 已創建 .env.development 文件', 'green');
        
        // 檢查 .gitignore 是否包含 .env.development
        const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
        if (!gitignoreContent.includes('.env.development')) {
            fs.appendFileSync('.gitignore', '\n# 開發環境配置\n.env.development\n');
            log('   ✅ 已更新 .gitignore', 'green');
        }
    } catch (error) {
        log(`   ❌ 創建配置文件失敗: ${error.message}`, 'red');
    }
}

function displayAdvantages() {
    log('\n✨ 單一倉庫雙環境的優勢', 'bright');
    log('='.repeat(50), 'cyan');
    
    log('\n✅ 優點：', 'green');
    log('   • 程式碼統一管理，避免分散', 'reset');
    log('   • 分支合併簡單，變更追蹤容易', 'reset');
    log('   • 共享 CI/CD 設置和腳本', 'reset');
    log('   • 減少維護複雜度', 'reset');
    log('   • Railway 免費額度更充分利用', 'reset');
    
    log('\n🔒 資料隔離：', 'yellow');
    log('   • 不同的向量庫 ID', 'reset');
    log('   • 不同的 Google OAuth 憑證', 'reset');
    log('   • 不同的域名和回調 URL', 'reset');
    log('   • 環境變數完全獨立', 'reset');
}

function main() {
    log('🏗️  Git 分支結構設置工具', 'bright');
    log('   使用單一倉庫管理雙環境', 'cyan');
    log(''.padEnd(50, '='), 'cyan');
    
    displayAdvantages();
    
    log('\n🤔 是否要自動設置分支結構？', 'yellow');
    log('   這將會：', 'reset');
    log('   • 創建 development 分支', 'cyan');
    log('   • 推送到遠程倉庫', 'cyan');
    log('   • 創建開發環境配置文件', 'cyan');
    
    // 在實際使用時，這裡可以添加用戶確認邏輯
    // 現在先顯示手動設置指南
    
    log('\n📋 手動設置步驟：', 'bright');
    log('='.repeat(30), 'cyan');
    
    log('\n1️⃣ 創建開發分支', 'yellow');
    log('   git checkout -b development', 'green');
    log('   git push -u origin development', 'green');
    
    log('\n2️⃣ 在 Railway 中設置兩個服務', 'yellow');
    log('   • 現有服務：部署 main 分支（正式環境）', 'cyan');
    log('   • 新服務：部署 development 分支（開發環境）', 'cyan');
    
    setupBranches();
    displayRailwaySetup();
    createDevEnvironmentFile();
    
    log('\n🎉 設置完成！', 'bright');
    log('   您現在可以：', 'cyan');
    log('   • 在 development 分支開發新功能', 'green');
    log('   • 在開發環境測試', 'green');
    log('   • 測試通過後合併到 main 分支', 'green');
    log('   • 自動部署到正式環境', 'green');
}

if (require.main === module) {
    main();
}

module.exports = {
    setupBranches,
    displayRailwaySetup,
    createDevEnvironmentFile
};
