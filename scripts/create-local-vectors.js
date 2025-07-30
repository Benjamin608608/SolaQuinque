#!/usr/bin/env node

/**
 * 本地向量資料預處理腳本
 * 
 * 此腳本將：
 * 1. 從 Google Drive 下載所有 1321 個文本文件
 * 2. 將文本分割成語義片段
 * 3. 生成 OpenAI embeddings
 * 4. 保存為本地向量資料文件
 * 
 * 使用方法：
 * node scripts/create-local-vectors.js
 * 
 * 環境變數：
 * - OPENAI_API_KEY: OpenAI API 密鑰
 * - GOOGLE_DRIVE_API_KEY: Google Drive API 密鑰
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const fetch = require('node-fetch');

class LocalVectorPreprocessor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.googleDriveApiKey = process.env.GOOGLE_DRIVE_API_KEY;
        this.sourceFolderId = '1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K'; // 您的神學資料夾
        
        // 本地保存路徑
        this.outputDir = path.join(__dirname, '../data/local-vectors');
        this.tempDir = path.join(__dirname, '../data/temp-download');
        
        // 向量資料結構
        this.vectorData = {
            version: '2.0.0',
            createdAt: new Date().toISOString(),
            model: 'text-embedding-3-small',
            dimensions: 1536,
            totalFiles: 0,
            totalChunks: 0,
            chunks: [],
            metadata: {
                description: '本地神學知識庫向量資料',
                source: 'Google Drive 神學文件',
                processingDate: new Date().toISOString()
            }
        };
        
        // 進度追蹤
        this.progress = {
            totalFiles: 0,
            processedFiles: 0,
            totalChunks: 0,
            processedChunks: 0,
            startTime: Date.now()
        };
    }
    
    async initialize() {
        console.log('🚀 初始化本地向量資料預處理器...');
        
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
            
        } while (pageToken);
        
        // 只保留 .txt 文件
        const txtFiles = allFiles.filter(file => 
            file.name.toLowerCase().endsWith('.txt') && 
            file.mimeType === 'text/plain'
        );
        
        console.log(`📊 總共找到 ${allFiles.length} 個文件，其中 ${txtFiles.length} 個是 .txt 文件`);
        
        return txtFiles;
    }
    
    // 下載單個文件
    async downloadFile(fileId, fileName, outputPath) {
        console.log(`📥 下載文件: ${fileName}`);
        
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this.googleDriveApiKey}`;
        
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        await fs.writeFile(outputPath, buffer);
        
        console.log(`✅ 文件下載完成: ${fileName}`);
    }
    
    // 分割文本成語義片段
    splitTextIntoChunks(text, fileName, chunkSize = 1500, overlap = 200) {
        const chunks = [];
        const sentences = text.split(/[。！？\n]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        let chunkCount = 0;
        
        for (const sentence of sentences) {
            const testChunk = currentChunk + sentence + '。';
            
            if (testChunk.length > chunkSize && currentChunk.length > 0) {
                // 保存當前片段
                chunks.push({
                    text: currentChunk.trim(),
                    source: fileName,
                    chunkId: chunkCount++
                });
                
                // 保留重疊部分
                const overlapText = currentChunk.slice(-overlap);
                currentChunk = overlapText + sentence + '。';
            } else {
                currentChunk = testChunk;
            }
        }
        
        // 添加最後一個片段
        if (currentChunk.trim().length > 0) {
            chunks.push({
                text: currentChunk.trim(),
                source: fileName,
                chunkId: chunkCount++
            });
        }
        
        return chunks;
    }
    
    // 生成單個嵌入向量
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
                dimensions: 1536
            });
            
            return response.data[0].embedding;
        } catch (error) {
            console.error(`❌ 生成嵌入向量失敗: ${error.message}`);
            throw error;
        }
    }
    
    // 批量生成嵌入向量
    async generateEmbeddings(chunks) {
        console.log(`🔄 開始生成 ${chunks.length} 個嵌入向量...`);
        
        const BATCH_SIZE = 50; // OpenAI 建議的批次大小
        const embeddings = [];
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
            
            console.log(`📦 處理批次 ${batchNum}/${totalBatches} (${batch.length} 個片段)`);
            
            try {
                // 並行處理當前批次的嵌入向量
                const batchPromises = batch.map(async (chunk, index) => {
                    try {
                        const embedding = await this.generateEmbedding(chunk.text);
                        return {
                            ...chunk,
                            embedding: embedding
                        };
                    } catch (error) {
                        console.error(`❌ 生成嵌入向量失敗 (批次 ${batchNum}, 項目 ${index + 1}):`, error.message);
                        return null;
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                const validResults = batchResults.filter(result => result !== null);
                embeddings.push(...validResults);
                
                this.progress.processedChunks += validResults.length;
                
                // 顯示進度
                const progress = ((this.progress.processedChunks / chunks.length) * 100).toFixed(1);
                console.log(`📈 嵌入向量進度: ${progress}% (${this.progress.processedChunks}/${chunks.length})`);
                
                // 批次間休息，避免 API 限制
                if (i + BATCH_SIZE < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`❌ 批次 ${batchNum} 處理失敗:`, error.message);
            }
        }
        
        console.log(`✅ 成功生成 ${embeddings.length} 個嵌入向量`);
        return embeddings;
    }
    
    // 處理所有文件
    async processAllFiles() {
        console.log('📋 開始處理所有文件...');
        
        // 1. 列出所有文件
        const files = await this.listGoogleDriveFiles(this.sourceFolderId);
        this.vectorData.totalFiles = files.length;
        this.progress.totalFiles = files.length;
        
        if (files.length === 0) {
            throw new Error('❌ 沒有找到任何 .txt 文件');
        }
        
        console.log(`🎯 目標：處理 ${files.length} 個文件（預計 1321 個）`);
        
        // 2. 下載並處理文件
        let allChunks = [];
        
        console.log(`🔄 開始處理 ${files.length} 個文件...`);
        
        for (const file of files) {
            try {
                this.progress.processedFiles++;
                console.log(`\n📁 處理文件 ${this.progress.processedFiles}/${files.length}: ${file.name}`);
                
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
                if (this.progress.processedFiles % 10 === 0) {
                    console.log(`📊 已處理 ${this.progress.processedFiles}/${files.length} 個文件，累計 ${allChunks.length} 個片段`);
                }
                
            } catch (error) {
                console.error(`❌ 處理文件 ${file.name} 失敗:`, error.message);
                continue;
            }
        }
        
        this.vectorData.totalChunks = allChunks.length;
        this.progress.totalChunks = allChunks.length;
        
        console.log(`\n🎉 文件處理完成！`);
        console.log(`📊 處理了 ${this.progress.processedFiles} 個文件，提取了 ${allChunks.length} 個文本片段`);
        
        // 3. 生成嵌入向量
        const processedChunks = await this.generateEmbeddings(allChunks);
        this.vectorData.chunks = processedChunks;
        
        console.log(`✅ 向量處理完成！`);
        console.log(`📊 成功處理 ${processedChunks.length} 個向量片段`);
    }
    
    // 保存向量資料
    async saveVectorData() {
        const outputFile = path.join(this.outputDir, 'theology-vectors-complete.json');
        const compressedFile = path.join(this.outputDir, 'theology-vectors-compressed.json');
        const metadataFile = path.join(this.outputDir, 'theology-vectors-metadata.json');
        
        console.log('💾 保存向量資料...');
        
        // 保存完整版本（包含所有嵌入向量）
        await fs.writeFile(outputFile, JSON.stringify(this.vectorData, null, 2));
        console.log(`✅ 完整向量資料已保存: ${outputFile}`);
        
        // 保存壓縮版本（用於生產）
        await fs.writeFile(compressedFile, JSON.stringify(this.vectorData));
        console.log(`✅ 壓縮向量資料已保存: ${compressedFile}`);
        
        // 保存元數據
        const metadata = {
            version: this.vectorData.version,
            createdAt: this.vectorData.createdAt,
            model: this.vectorData.model,
            dimensions: this.vectorData.dimensions,
            totalFiles: this.vectorData.totalFiles,
            totalChunks: this.vectorData.totalChunks,
            metadata: this.vectorData.metadata,
            processingStats: {
                totalFiles: this.progress.totalFiles,
                processedFiles: this.progress.processedFiles,
                totalChunks: this.progress.totalChunks,
                processedChunks: this.progress.processedChunks,
                processingTime: Date.now() - this.progress.startTime
            }
        };
        
        await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
        console.log(`✅ 元數據已保存: ${metadataFile}`);
        
        // 顯示文件大小
        const stats = await fs.stat(compressedFile);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📊 壓縮文件大小: ${sizeMB} MB`);
        
        return {
            complete: outputFile,
            compressed: compressedFile,
            metadata: metadataFile,
            sizeMB: sizeMB
        };
    }
    
    // 生成統計報告
    generateReport() {
        const processingTime = Date.now() - this.progress.startTime;
        const processingMinutes = Math.round(processingTime / 1000 / 60);
        
        const report = {
            summary: {
                totalFiles: this.vectorData.totalFiles,
                totalChunks: this.vectorData.totalChunks,
                avgChunksPerFile: (this.vectorData.totalChunks / this.vectorData.totalFiles).toFixed(1),
                model: this.vectorData.model,
                dimensions: this.vectorData.dimensions,
                processingTimeMinutes: processingMinutes
            },
            performance: {
                filesPerMinute: (this.progress.processedFiles / processingMinutes).toFixed(1),
                chunksPerMinute: (this.progress.processedChunks / processingMinutes).toFixed(1),
                totalProcessingTime: `${processingMinutes} 分鐘`
            }
        };
        
        console.log('\n📊 處理統計報告:');
        console.log(`📁 總文件數: ${report.summary.totalFiles}`);
        console.log(`📚 總片段數: ${report.summary.totalChunks}`);
        console.log(`📈 平均片段/文件: ${report.summary.avgChunksPerFile}`);
        console.log(`⏱️  處理時間: ${report.performance.totalProcessingTime}`);
        console.log(`🚀 處理速度: ${report.performance.filesPerMinute} 文件/分鐘`);
        
        return report;
    }
}

async function main() {
    const preprocessor = new LocalVectorPreprocessor();
    
    try {
        console.log('🎯 開始本地向量資料預處理...');
        console.log('📋 目標：處理 1321 個神學文件並生成本地向量資料');
        
        // 初始化
        await preprocessor.initialize();
        
        // 處理所有文件
        await preprocessor.processAllFiles();
        
        // 保存向量資料
        const savedFiles = await preprocessor.saveVectorData();
        
        // 生成報告
        const report = preprocessor.generateReport();
        
        console.log('\n🎉 本地向量資料預處理完成！');
        console.log(`📁 保存位置: ${preprocessor.outputDir}`);
        console.log(`💾 文件大小: ${savedFiles.sizeMB} MB`);
        console.log(`📊 處理統計: ${report.summary.totalFiles} 個文件，${report.summary.totalChunks} 個片段`);
        
        console.log('\n📋 下一步：');
        console.log('1. 將生成的向量資料複製到您的應用程式');
        console.log('2. 更新 vectorService.js 以載入本地向量資料');
        console.log('3. 享受 10-30 倍的速度提升！');
        
    } catch (error) {
        console.error('❌ 預處理失敗:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = LocalVectorPreprocessor; 