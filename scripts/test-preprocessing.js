#!/usr/bin/env node

/**
 * 預處理測試腳本
 * 測試文件下載和文本分割功能，不需要 OpenAI API
 */

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

class PreprocessingTester {
    constructor() {
        this.googleDriveApiKey = process.env.GOOGLE_DRIVE_API_KEY || 'AIzaSyCdI0rjMKiPW7lJKiMtmbc8B1EuzWqzWdM';
        this.sourceFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K';
        
        this.outputDir = path.join(__dirname, '../data/test-preprocessing');
        this.tempDir = path.join(__dirname, '../data/temp-test');
    }
    
    async initialize() {
        console.log('🚀 初始化預處理測試器...');
        
        // 創建必要的目錄
        await fs.mkdir(this.outputDir, { recursive: true });
        await fs.mkdir(this.tempDir, { recursive: true });
        
        console.log('✅ 測試器初始化完成');
        console.log(`📁 輸出目錄: ${this.outputDir}`);
        console.log(`📁 臨時目錄: ${this.tempDir}`);
    }
    
    // 列出 Google Drive 資料夾中的文件
    async listGoogleDriveFiles(folderId, maxFiles = 10) {
        console.log(`📋 列出 Google Drive 資料夾中的文件: ${folderId} (最多 ${maxFiles} 個)`);
        
        const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size),nextPageToken&pageSize=${maxFiles}&key=${this.googleDriveApiKey}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Google Drive API 請求失敗: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        // 過濾出 .txt 文件
        const textFiles = files.filter(file => 
            file.name.toLowerCase().endsWith('.txt') && 
            file.mimeType === 'text/plain'
        );
        
        console.log(`🎉 獲取到 ${files.length} 個文件，其中 ${textFiles.length} 個 .txt 文件`);
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
        
        const content = await response.text();
        await fs.writeFile(outputPath, content, 'utf-8');
        
        console.log(`✅ 下載完成: ${fileName} (${content.length} 字符)`);
        return content;
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
                const overlapWords = words.slice(-Math.floor(overlap / 5));
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
    
    // 測試處理少量文件
    async testProcessing(maxFiles = 5) {
        console.log(`📋 開始測試處理（最多 ${maxFiles} 個文件）...`);
        
        // 1. 列出文件
        const files = await this.listGoogleDriveFiles(this.sourceFolderId, maxFiles);
        
        if (files.length === 0) {
            throw new Error('❌ 沒有找到任何 .txt 文件');
        }
        
        // 2. 處理文件
        let allChunks = [];
        let processedFiles = 0;
        
        for (const file of files) {
            try {
                processedFiles++;
                console.log(`\n📁 處理文件 ${processedFiles}/${files.length}: ${file.name}`);
                
                // 下載文件
                const tempFilePath = path.join(this.tempDir, file.name);
                const content = await this.downloadFile(file.id, file.name, tempFilePath);
                
                // 分割成片段
                const chunks = this.splitTextIntoChunks(content, file.name);
                console.log(`📚 提取了 ${chunks.length} 個文本片段`);
                
                allChunks.push(...chunks);
                
                // 清理臨時文件
                await fs.unlink(tempFilePath);
                
            } catch (error) {
                console.error(`❌ 處理文件 ${file.name} 失敗:`, error.message);
                continue;
            }
        }
        
        console.log(`\n🎉 測試處理完成！`);
        console.log(`📊 處理了 ${processedFiles} 個文件，提取了 ${allChunks.length} 個文本片段`);
        
        // 3. 保存測試結果
        const testResult = {
            processedFiles: processedFiles,
            totalChunks: allChunks.length,
            avgChunksPerFile: (allChunks.length / processedFiles).toFixed(1),
            chunks: allChunks.slice(0, 10), // 只保存前 10 個片段作為樣本
            summary: this.generateSummary(allChunks)
        };
        
        const outputFile = path.join(this.outputDir, 'test-result.json');
        await fs.writeFile(outputFile, JSON.stringify(testResult, null, 2));
        console.log(`💾 測試結果已保存: ${outputFile}`);
        
        return testResult;
    }
    
    // 生成統計摘要
    generateSummary(chunks) {
        const summary = {
            totalChunks: chunks.length,
            avgLength: 0,
            avgWordCount: 0,
            minLength: Infinity,
            maxLength: 0,
            fileStats: {}
        };
        
        for (const chunk of chunks) {
            const length = chunk.metadata.length;
            const wordCount = chunk.metadata.wordCount;
            
            summary.avgLength += length;
            summary.avgWordCount += wordCount;
            summary.minLength = Math.min(summary.minLength, length);
            summary.maxLength = Math.max(summary.maxLength, length);
            
            if (!summary.fileStats[chunk.source]) {
                summary.fileStats[chunk.source] = 0;
            }
            summary.fileStats[chunk.source]++;
        }
        
        summary.avgLength = Math.round(summary.avgLength / chunks.length);
        summary.avgWordCount = Math.round(summary.avgWordCount / chunks.length);
        
        return summary;
    }
}

// 主執行函數
async function main() {
    const tester = new PreprocessingTester();
    
    try {
        console.log('🚀 開始預處理測試...\n');
        
        // 初始化
        await tester.initialize();
        
        // 測試處理
        const result = await tester.testProcessing(5);
        
        // 顯示結果
        console.log('\n📊 測試結果摘要:');
        console.log(`📁 處理文件數: ${result.processedFiles}`);
        console.log(`📚 總片段數: ${result.totalChunks}`);
        console.log(`📈 平均每文件片段數: ${result.avgChunksPerFile}`);
        console.log(`📏 平均片段長度: ${result.summary.avgLength} 字符`);
        console.log(`📝 平均詞數: ${result.summary.avgWordCount} 詞`);
        
        console.log('\n🎉 預處理測試完成！');
        console.log('💡 下一步：設置 OpenAI API 密鑰，運行完整的預處理腳本');
        
    } catch (error) {
        console.error('\n❌ 測試失敗:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    main();
}

module.exports = PreprocessingTester;