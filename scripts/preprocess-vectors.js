#!/usr/bin/env node

/**
 * 向量資料預處理腳本
 * 
 * 此腳本將：
 * 1. 從 Google Drive 下載所有文本文件
 * 2. 將文本分割成語義片段
 * 3. 生成 OpenAI embeddings
 * 4. 保存為緊湊的向量資料文件
 * 5. 可選：上傳處理後的向量資料到 Google Drive
 * 
 * 使用方法：
 * node scripts/preprocess-vectors.js
 * 
 * 環境變數：
 * - OPENAI_API_KEY: OpenAI API 密鑰
 * - GOOGLE_DRIVE_API_KEY: Google Drive API 密鑰
 * - GOOGLE_DRIVE_FOLDER_ID: 源文件資料夾 ID
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const fetch = require('node-fetch');

class VectorPreprocessor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.googleDriveApiKey = process.env.GOOGLE_DRIVE_API_KEY;
        this.sourceFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K';
        
        this.outputDir = path.join(__dirname, '../data/preprocessed');
        this.tempDir = path.join(__dirname, '../data/temp');
        
        // 向量資料結構
        this.vectorData = {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            model: 'text-embedding-3-small',
            dimensions: 1536,
            totalFiles: 0,
            totalChunks: 0,
            chunks: []  // { text, source, embedding, metadata }
        };
    }
    
    async initialize() {
        console.log('🚀 初始化向量資料預處理器...');
        
        // 檢查必要的環境變數
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('❌ 缺少 OPENAI_API_KEY 環境變數');
        }
        
        if (!this.googleDriveApiKey) {
            throw new Error('❌ 缺少 GOOGLE_DRIVE_API_KEY 環境變數');
        }
        
        // 創建必要的目錄
        await fs.mkdir(this.outputDir, { recursive: true });
        await fs.mkdir(this.tempDir, { recursive: true });
        
        console.log('✅ 預處理器初始化完成');
        console.log(`📁 輸出目錄: ${this.outputDir}`);
        console.log(`📁 臨時目錄: ${this.tempDir}`);
    }
    
    // 列出 Google Drive 資料夾中的所有文件
    async listGoogleDriveFiles(folderId) {
        console.log(`📋 列出 Google Drive 資料夾中的文件: ${folderId}`);
        
        let allFiles = [];
        let pageToken = null;
        let pageCount = 0;
        
        do {
            pageCount++;
            console.log(`📄 獲取第 ${pageCount} 頁文件...`);
            
            let apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size),nextPageToken&pageSize=1000&key=${this.googleDriveApiKey}`;
            if (pageToken) {
                apiUrl += `&pageToken=${pageToken}`;
            }
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Google Drive API 請求失敗: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const files = data.files || [];
            
            console.log(`✅ 第 ${pageCount} 頁獲取到 ${files.length} 個文件`);
            allFiles.push(...files);
            pageToken = data.nextPageToken;
            
            if (pageToken) {
                console.log(`🔄 發現更多文件，準備獲取下一頁...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } while (pageToken);
        
        // 過濾出 .txt 文件
        const textFiles = allFiles.filter(file => 
            file.name.toLowerCase().endsWith('.txt') && 
            file.mimeType === 'text/plain'
        );
        
        console.log(`🎉 總共獲取到 ${allFiles.length} 個文件，其中 ${textFiles.length} 個 .txt 文件`);
        return textFiles;
    }
    
    // 下載單個文件
    async downloadFile(fileId, fileName, outputPath) {
        console.log(`📥 下載文件: ${fileName}`);
        
        const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
        
        const response = await fetch(downloadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
        }
        
        const fileStream = require('fs').createWriteStream(outputPath);
        response.body.pipe(fileStream);
        
        return new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    }
    
    // 將文本分割成語義片段
    splitTextIntoChunks(text, fileName) {
        const chunkSize = 1500;  // 高品質設定
        const overlap = 200;
        const chunks = [];
        
        // 按段落分割
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        let currentChunk = '';
        let chunkIndex = 0;
        
        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            
            // 跳過太短的段落
            if (trimmedParagraph.length < 100) continue;
            
            if (currentChunk.length + trimmedParagraph.length > chunkSize && currentChunk.length > 0) {
                // 保存當前片段
                chunks.push({
                    text: currentChunk.trim(),
                    source: fileName,
                    chunkIndex: chunkIndex++,
                    metadata: {
                        length: currentChunk.length,
                        wordCount: currentChunk.split(/\s+/).length
                    }
                });
                
                // 開始新片段，保留重疊部分
                const words = currentChunk.split(/\s+/);
                const overlapWords = words.slice(-Math.floor(overlap / 5)); // 大約 overlap 字符的詞數
                currentChunk = overlapWords.join(' ') + ' ' + trimmedParagraph;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
            }
        }
        
        // 保存最後一個片段
        if (currentChunk.trim().length > 100) {
            chunks.push({
                text: currentChunk.trim(),
                source: fileName,
                chunkIndex: chunkIndex,
                metadata: {
                    length: currentChunk.length,
                    wordCount: currentChunk.split(/\s+/).length
                }
            });
        }
        
        return chunks;
    }
    
    // 生成嵌入向量
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
                dimensions: 1536
            });
            
            return Array.from(response.data[0].embedding);
        } catch (error) {
            console.error('❌ 生成嵌入向量失敗:', error.message);
            // 返回零向量作為後備
            return new Array(1536).fill(0);
        }
    }
    
    // 批量生成嵌入向量
    async generateEmbeddings(chunks) {
        console.log(`🔄 開始生成 ${chunks.length} 個嵌入向量...`);
        
        const BATCH_SIZE = 50;
        const PROGRESS_INTERVAL = 100;
        let processedCount = 0;
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
            
            console.log(`📦 處理嵌入向量批次 ${batchNum}/${totalBatches} (${batch.length} 個片段)`);
            
            try {
                const batchPromises = batch.map(async (chunk) => {
                    const embedding = await this.generateEmbedding(chunk.text);
                    return { ...chunk, embedding };
                });
                
                const batchResults = await Promise.all(batchPromises);
                
                // 添加到主資料結構
                this.vectorData.chunks.push(...batchResults);
                
                processedCount += batch.length;
                
                if (processedCount % PROGRESS_INTERVAL === 0 || batchNum === totalBatches) {
                    const progress = ((processedCount / chunks.length) * 100).toFixed(1);
                    console.log(`📈 嵌入向量進度: ${progress}% (${processedCount}/${chunks.length})`);
                }
                
                // API 限制：每分鐘最多 3000 requests
                if (i + BATCH_SIZE < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`❌ 批次 ${batchNum} 處理失敗:`, error.message);
                // 添加零向量作為後備
                const fallbackResults = batch.map(chunk => ({
                    ...chunk,
                    embedding: new Array(1536).fill(0)
                }));
                this.vectorData.chunks.push(...fallbackResults);
                processedCount += batch.length;
            }
        }
        
        console.log(`✅ 成功生成 ${this.vectorData.chunks.length} 個嵌入向量`);
    }
    
    // 處理所有文件
    async processAllFiles() {
        console.log('📋 開始處理所有文件...');
        
        // 1. 列出所有文件
        const files = await this.listGoogleDriveFiles(this.sourceFolderId);
        this.vectorData.totalFiles = files.length;
        
        if (files.length === 0) {
            throw new Error('❌ 沒有找到任何 .txt 文件');
        }
        
        // 2. 下載並處理文件
        let allChunks = [];
        let processedFiles = 0;
        
        console.log(`🔄 開始處理 ${files.length} 個文件...`);
        
        for (const file of files) {
            try {
                processedFiles++;
                console.log(`\n📁 處理文件 ${processedFiles}/${files.length}: ${file.name}`);
                
                // 下載文件
                const tempFilePath = path.join(this.tempDir, file.name);
                await this.downloadFile(file.id, file.name, tempFilePath);
                
                // 讀取文件內容
                const content = await fs.readFile(tempFilePath, 'utf-8');
                
                // 分割成片段
                const chunks = this.splitTextIntoChunks(content, file.name);
                console.log(`📚 提取了 ${chunks.length} 個文本片段`);
                
                allChunks.push(...chunks);
                
                // 清理臨時文件
                await fs.unlink(tempFilePath);
                
                // 進度報告
                if (processedFiles % 10 === 0) {
                    console.log(`📊 已處理 ${processedFiles}/${files.length} 個文件，累計 ${allChunks.length} 個片段`);
                }
                
            } catch (error) {
                console.error(`❌ 處理文件 ${file.name} 失敗:`, error.message);
                continue;
            }
        }
        
        this.vectorData.totalChunks = allChunks.length;
        console.log(`\n🎉 文件處理完成！`);
        console.log(`📊 處理了 ${processedFiles} 個文件，提取了 ${allChunks.length} 個文本片段`);
        
        // 3. 生成嵌入向量
        await this.generateEmbeddings(allChunks);
    }
    
    // 保存向量資料
    async saveVectorData() {
        const outputFile = path.join(this.outputDir, 'theology-vectors.json');
        const compressedFile = path.join(this.outputDir, 'theology-vectors-compressed.json');
        
        console.log('💾 保存向量資料...');
        
        // 保存完整版本（用於調試）
        await fs.writeFile(outputFile, JSON.stringify(this.vectorData, null, 2));
        console.log(`✅ 完整向量資料已保存: ${outputFile}`);
        
        // 保存壓縮版本（用於生產）
        await fs.writeFile(compressedFile, JSON.stringify(this.vectorData));
        console.log(`✅ 壓縮向量資料已保存: ${compressedFile}`);
        
        // 顯示文件大小
        const stats = await fs.stat(compressedFile);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📊 壓縮文件大小: ${sizeMB} MB`);
        
        return compressedFile;
    }
    
    // 生成統計報告
    generateReport() {
        const report = {
            summary: {
                totalFiles: this.vectorData.totalFiles,
                totalChunks: this.vectorData.totalChunks,
                avgChunksPerFile: (this.vectorData.totalChunks / this.vectorData.totalFiles).toFixed(1),
                model: this.vectorData.model,
                dimensions: this.vectorData.dimensions
            },
            fileStats: {},
            chunkStats: {
                avgLength: 0,
                avgWordCount: 0,
                minLength: Infinity,
                maxLength: 0
            }
        };
        
        // 計算文件統計
        for (const chunk of this.vectorData.chunks) {
            if (!report.fileStats[chunk.source]) {
                report.fileStats[chunk.source] = 0;
            }
            report.fileStats[chunk.source]++;
            
            // 片段統計
            const length = chunk.metadata.length;
            const wordCount = chunk.metadata.wordCount;
            
            report.chunkStats.avgLength += length;
            report.chunkStats.avgWordCount += wordCount;
            report.chunkStats.minLength = Math.min(report.chunkStats.minLength, length);
            report.chunkStats.maxLength = Math.max(report.chunkStats.maxLength, length);
        }
        
        report.chunkStats.avgLength = Math.round(report.chunkStats.avgLength / this.vectorData.totalChunks);
        report.chunkStats.avgWordCount = Math.round(report.chunkStats.avgWordCount / this.vectorData.totalChunks);
        
        return report;
    }
}

// 主執行函數
async function main() {
    const preprocessor = new VectorPreprocessor();
    
    try {
        console.log('🚀 開始向量資料預處理...\n');
        
        // 初始化
        await preprocessor.initialize();
        
        // 處理所有文件
        await preprocessor.processAllFiles();
        
        // 保存結果
        const outputFile = await preprocessor.saveVectorData();
        
        // 生成報告
        const report = preprocessor.generateReport();
        console.log('\n📊 處理報告:');
        console.log(JSON.stringify(report, null, 2));
        
        // 保存報告
        const reportFile = path.join(preprocessor.outputDir, 'processing-report.json');
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        console.log(`📋 處理報告已保存: ${reportFile}`);
        
        console.log('\n🎉 向量資料預處理完成！');
        console.log(`📁 輸出文件: ${outputFile}`);
        console.log('\n💡 下一步：');
        console.log('1. 將 theology-vectors-compressed.json 上傳到 Google Drive');
        console.log('2. 更新 Railway 應用以載入預處理的向量資料');
        console.log('3. 享受快速的啟動時間！🚀');
        
    } catch (error) {
        console.error('\n❌ 預處理失敗:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    main();
}

module.exports = VectorPreprocessor;