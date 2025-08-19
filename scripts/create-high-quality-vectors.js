#!/usr/bin/env node

/**
 * 高品質向量資料預處理腳本
 * 
 * 此腳本專注於品質而非速度：
 * 1. 使用更精確的文本分割策略
 * 2. 使用更高品質的嵌入模型
 * 3. 添加語義驗證和品質檢查
 * 4. 保留完整的上下文信息
 * 5. 生成詳細的品質報告
 * 
 * 使用方法：
 * node scripts/create-high-quality-vectors.js
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const fetch = require('node-fetch');

class HighQualityVectorPreprocessor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.googleDriveApiKey = process.env.GOOGLE_DRIVE_API_KEY;
        this.sourceFolderId = '1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K';
        
        // 高品質設置
        this.outputDir = path.join(__dirname, '../data/high-quality-vectors');
        this.tempDir = path.join(__dirname, '../data/temp-hq');
        this.logDir = path.join(__dirname, '../data/processing-logs');
        
        // 高品質向量資料結構
        this.vectorData = {
            version: '3.0.0',
            createdAt: new Date().toISOString(),
            model: 'text-embedding-3-large', // 使用更高品質的模型
            dimensions: 3072, // 更高維度
            qualitySettings: {
                chunkSize: 2000, // 更大的語義片段
                overlap: 300, // 更多的重疊以保持上下文
                minChunkLength: 100, // 最小片段長度
                maxChunkLength: 4000, // 最大片段長度
                semanticValidation: true,
                contextPreservation: true
            },
            totalFiles: 0,
            totalChunks: 0,
            qualityStats: {
                highQualityChunks: 0,
                mediumQualityChunks: 0,
                lowQualityChunks: 0,
                rejectedChunks: 0
            },
            chunks: [],
            metadata: {
                description: '高品質神學知識庫向量資料',
                source: 'Google Drive 神學文件',
                processingDate: new Date().toISOString(),
                qualityFocus: '語義準確性和上下文完整性'
            }
        };
        
        // 詳細進度追蹤
        this.progress = {
            totalFiles: 0,
            processedFiles: 0,
            totalChunks: 0,
            processedChunks: 0,
            startTime: Date.now(),
            qualityChecks: 0,
            semanticValidations: 0
        };
    }
    
    async initialize() {
        console.log('🚀 初始化高品質向量資料預處理器...');
        
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
        await fs.mkdir(this.logDir, { recursive: true });
        
        console.log('✅ 高品質預處理器初始化完成');
        console.log(`📁 輸出目錄: ${this.outputDir}`);
        console.log(`📁 臨時目錄: ${this.tempDir}`);
        console.log(`📁 日誌目錄: ${this.logDir}`);
        
        // 顯示品質設置
        console.log('\n🎯 高品質設置：');
        console.log(`📏 片段大小: ${this.vectorData.qualitySettings.chunkSize} 字符`);
        console.log(`🔄 重疊大小: ${this.vectorData.qualitySettings.overlap} 字符`);
        console.log(`🤖 嵌入模型: ${this.vectorData.model}`);
        console.log(`📐 向量維度: ${this.vectorData.dimensions}`);
        console.log(`✅ 語義驗證: 啟用`);
        console.log(`✅ 上下文保留: 啟用`);
    }
    
    // 高品質文本分割
    splitTextIntoQualityChunks(text, fileName) {
        console.log(`📚 高品質文本分割: ${fileName}`);
        
        const chunks = [];
        const settings = this.vectorData.qualitySettings;
        
        // 1. 按段落分割（保持語義完整性）
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        let currentChunk = '';
        let chunkCount = 0;
        
        for (const paragraph of paragraphs) {
            const cleanParagraph = paragraph.trim();
            
            // 檢查段落是否太長，需要進一步分割
            if (cleanParagraph.length > settings.maxChunkLength) {
                // 按句子分割長段落
                const sentences = this.splitIntoSentences(cleanParagraph);
                
                for (const sentence of sentences) {
                    const testChunk = currentChunk + sentence + ' ';
                    
                    if (testChunk.length > settings.chunkSize && currentChunk.length > 0) {
                        // 保存當前片段
                        const chunk = this.createQualityChunk(currentChunk.trim(), fileName, chunkCount++);
                        if (chunk) chunks.push(chunk);
                        
                        // 保留重疊部分
                        const overlapText = currentChunk.slice(-settings.overlap);
                        currentChunk = overlapText + sentence + ' ';
                    } else {
                        currentChunk = testChunk;
                    }
                }
            } else {
                // 處理正常長度的段落
                const testChunk = currentChunk + cleanParagraph + '\n\n';
                
                if (testChunk.length > settings.chunkSize && currentChunk.length > 0) {
                    // 保存當前片段
                    const chunk = this.createQualityChunk(currentChunk.trim(), fileName, chunkCount++);
                    if (chunk) chunks.push(chunk);
                    
                    // 保留重疊部分
                    const overlapText = currentChunk.slice(-settings.overlap);
                    currentChunk = overlapText + cleanParagraph + '\n\n';
                } else {
                    currentChunk = testChunk;
                }
            }
        }
        
        // 添加最後一個片段
        if (currentChunk.trim().length > 0) {
            const chunk = this.createQualityChunk(currentChunk.trim(), fileName, chunkCount++);
            if (chunk) chunks.push(chunk);
        }
        
        console.log(`✅ 生成 ${chunks.length} 個高品質片段`);
        return chunks;
    }
    
    // 智能句子分割
    splitIntoSentences(text) {
        // 更精確的句子分割，考慮神學文本的特殊性
        const sentencePattern = /[。！？；\n]+/;
        return text.split(sentencePattern).filter(s => s.trim().length > 0);
    }
    
    // 創建高品質片段
    createQualityChunk(text, fileName, chunkId) {
        const settings = this.vectorData.qualitySettings;
        
        // 品質檢查
        if (text.length < settings.minChunkLength) {
            console.log(`⚠️  片段太短，跳過: ${text.length} 字符`);
            this.vectorData.qualityStats.rejectedChunks++;
            return null;
        }
        
        if (text.length > settings.maxChunkLength) {
            console.log(`⚠️  片段太長，需要進一步分割: ${text.length} 字符`);
            // 這裡可以進一步分割，但為了簡化，我們跳過
            this.vectorData.qualityStats.rejectedChunks++;
            return null;
        }
        
        // 語義品質檢查
        const qualityScore = this.assessChunkQuality(text);
        
        const chunk = {
            text: text,
            source: fileName,
            chunkId: chunkId,
            quality: {
                score: qualityScore,
                level: this.getQualityLevel(qualityScore),
                wordCount: text.split(/\s+/).length,
                characterCount: text.length,
                hasTheologicalTerms: this.hasTheologicalTerms(text),
                contextCompleteness: this.assessContextCompleteness(text)
            },
            metadata: {
                createdAt: new Date().toISOString(),
                processingVersion: '3.0.0'
            }
        };
        
        // 更新品質統計
        const level = chunk.quality.level;
        if (level === 'high') this.vectorData.qualityStats.highQualityChunks++;
        else if (level === 'medium') this.vectorData.qualityStats.mediumQualityChunks++;
        else this.vectorData.qualityStats.lowQualityChunks++;
        
        return chunk;
    }
    
    // 評估片段品質
    assessChunkQuality(text) {
        let score = 0;
        
        // 1. 長度評分 (0-30分)
        const length = text.length;
        if (length >= 500 && length <= 2000) score += 30;
        else if (length >= 200 && length < 500) score += 20;
        else if (length >= 100 && length < 200) score += 10;
        
        // 2. 神學術語評分 (0-25分)
        const theologicalTerms = this.countTheologicalTerms(text);
        if (theologicalTerms >= 3) score += 25;
        else if (theologicalTerms >= 1) score += 15;
        
        // 3. 語義完整性評分 (0-25分)
        if (this.isSemanticallyComplete(text)) score += 25;
        else if (this.hasPartialSemanticContent(text)) score += 15;
        
        // 4. 上下文連貫性評分 (0-20分)
        if (this.isContextuallyCoherent(text)) score += 20;
        else if (this.hasSomeContext(text)) score += 10;
        
        return Math.min(score, 100);
    }
    
    // 檢查神學術語
    hasTheologicalTerms(text) {
        const theologicalTerms = [
            '上帝', '神', '耶穌', '基督', '聖靈', '三位一體', '救恩', '原罪',
            '教會', '聖經', '福音', '信仰', '恩典', '信心', '愛', '公義',
            '聖潔', '憐憫', '寬恕', '悔改', '重生', '成聖', '榮耀', '永恆',
            '天國', '地獄', '審判', '復活', '永生', '十字架', '寶血', '贖罪'
        ];
        
        return theologicalTerms.some(term => text.includes(term));
    }
    
    // 計算神學術語數量
    countTheologicalTerms(text) {
        const theologicalTerms = [
            '上帝', '神', '耶穌', '基督', '聖靈', '三位一體', '救恩', '原罪',
            '教會', '聖經', '福音', '信仰', '恩典', '信心', '愛', '公義',
            '聖潔', '憐憫', '寬恕', '悔改', '重生', '成聖', '榮耀', '永恆',
            '天國', '地獄', '審判', '復活', '永生', '十字架', '寶血', '贖罪'
        ];
        
        return theologicalTerms.filter(term => text.includes(term)).length;
    }
    
    // 檢查語義完整性
    isSemanticallyComplete(text) {
        // 檢查是否有完整的句子結構
        const sentences = text.split(/[。！？]/);
        const completeSentences = sentences.filter(s => s.trim().length > 10);
        return completeSentences.length >= 2;
    }
    
    // 檢查部分語義內容
    hasPartialSemanticContent(text) {
        return text.includes('。') || text.includes('！') || text.includes('？');
    }
    
    // 檢查上下文連貫性
    isContextuallyCoherent(text) {
        // 檢查是否有連接詞和邏輯關係
        const connectors = ['因此', '所以', '然而', '但是', '而且', '並且', '因為', '由於'];
        return connectors.some(connector => text.includes(connector));
    }
    
    // 檢查部分上下文
    hasSomeContext(text) {
        return text.length > 200; // 較長的文本通常有更多上下文
    }
    
    // 獲取品質等級
    getQualityLevel(score) {
        if (score >= 80) return 'high';
        else if (score >= 60) return 'medium';
        else return 'low';
    }
    
    // 語義驗證
    async validateChunkSemantics(chunk) {
        try {
                const response = await this.openai.chat.completions.create({
                    model: process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "您是一個神學文本品質評估專家。請評估以下文本片段的語義完整性和神學準確性。"
                    },
                    {
                        role: "user",
                        content: `請評估以下神學文本片段的品質（1-10分，10分最高）：

文本：${chunk.text}

請考慮：
1. 語義完整性
2. 神學準確性
3. 上下文清晰度
4. 信息價值

只返回分數（1-10的數字）。`
                    }
                ],
                temperature: 0.1,
                max_tokens: 10
            });
            
            const score = parseInt(response.choices[0].message.content.trim());
            return isNaN(score) ? 5 : Math.max(1, Math.min(10, score));
            
        } catch (error) {
            console.log(`⚠️  語義驗證失敗: ${error.message}`);
            return 5; // 默認中等分數
        }
    }
    
    // 生成高品質嵌入向量
    async generateHighQualityEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-large', // 使用更高品質的模型
                input: text,
                dimensions: 3072 // 更高維度
            });
            
            return response.data[0].embedding;
        } catch (error) {
            console.error(`❌ 生成高品質嵌入向量失敗: ${error.message}`);
            throw error;
        }
    }
    
    // 批量生成高品質嵌入向量
    async generateHighQualityEmbeddings(chunks) {
        console.log(`🔄 開始生成 ${chunks.length} 個高品質嵌入向量...`);
        
        const BATCH_SIZE = 25; // 較小的批次以確保品質
        const embeddings = [];
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
            
            console.log(`📦 處理高品質批次 ${batchNum}/${totalBatches} (${batch.length} 個片段)`);
            
            try {
                // 並行處理當前批次的嵌入向量
                const batchPromises = batch.map(async (chunk, index) => {
                    try {
                        // 語義驗證
                        const semanticScore = await this.validateChunkSemantics(chunk);
                        chunk.quality.semanticValidationScore = semanticScore;
                        
                        // 生成嵌入向量
                        const embedding = await this.generateHighQualityEmbedding(chunk.text);
                        
                        this.progress.semanticValidations++;
                        
                        return {
                            ...chunk,
                            embedding: embedding
                        };
                    } catch (error) {
                        console.error(`❌ 處理片段失敗 (批次 ${batchNum}, 項目 ${index + 1}):`, error.message);
                        return null;
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                const validResults = batchResults.filter(result => result !== null);
                embeddings.push(...validResults);
                
                this.progress.processedChunks += validResults.length;
                
                // 顯示進度
                const progress = ((this.progress.processedChunks / chunks.length) * 100).toFixed(1);
                console.log(`📈 高品質嵌入向量進度: ${progress}% (${this.progress.processedChunks}/${chunks.length})`);
                
                // 批次間休息，確保品質
                if (i + BATCH_SIZE < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`❌ 高品質批次 ${batchNum} 處理失敗:`, error.message);
            }
        }
        
        console.log(`✅ 成功生成 ${embeddings.length} 個高品質嵌入向量`);
        return embeddings;
    }
    
    // 其他方法保持與原腳本相同...
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
    
    async processAllFiles() {
        console.log('📋 開始高品質處理所有文件...');
        
        // 1. 列出所有文件
        const files = await this.listGoogleDriveFiles(this.sourceFolderId);
        this.vectorData.totalFiles = files.length;
        this.progress.totalFiles = files.length;
        
        if (files.length === 0) {
            throw new Error('❌ 沒有找到任何 .txt 文件');
        }
        
        console.log(`🎯 目標：高品質處理 ${files.length} 個文件（預計 1321 個）`);
        
        // 2. 下載並處理文件
        let allChunks = [];
        
        console.log(`🔄 開始高品質處理 ${files.length} 個文件...`);
        
        for (const file of files) {
            try {
                this.progress.processedFiles++;
                console.log(`\n📁 高品質處理文件 ${this.progress.processedFiles}/${files.length}: ${file.name}`);
                
                // 下載文件
                const tempFilePath = path.join(this.tempDir, file.name);
                await this.downloadFile(file.id, file.name, tempFilePath);
                
                // 讀取文件內容
                const content = await fs.readFile(tempFilePath, 'utf-8');
                
                // 高品質分割成片段
                const chunks = this.splitTextIntoQualityChunks(content, file.name);
                console.log(`📚 提取了 ${chunks.length} 個高品質文本片段`);
                
                allChunks.push(...chunks);
                
                // 清理臨時文件
                await fs.unlink(tempFilePath);
                
                // 進度報告
                if (this.progress.processedFiles % 5 === 0) {
                    console.log(`📊 已處理 ${this.progress.processedFiles}/${files.length} 個文件，累計 ${allChunks.length} 個高品質片段`);
                }
                
            } catch (error) {
                console.error(`❌ 高品質處理文件 ${file.name} 失敗:`, error.message);
                continue;
            }
        }
        
        this.vectorData.totalChunks = allChunks.length;
        this.progress.totalChunks = allChunks.length;
        
        console.log(`\n🎉 高品質文件處理完成！`);
        console.log(`📊 處理了 ${this.progress.processedFiles} 個文件，提取了 ${allChunks.length} 個高品質文本片段`);
        
        // 3. 生成高品質嵌入向量
        const processedChunks = await this.generateHighQualityEmbeddings(allChunks);
        this.vectorData.chunks = processedChunks;
        
        console.log(`✅ 高品質向量處理完成！`);
        console.log(`📊 成功處理 ${processedChunks.length} 個高品質向量片段`);
    }
    
    async saveVectorData() {
        const outputFile = path.join(this.outputDir, 'theology-vectors-hq-complete.json');
        const compressedFile = path.join(this.outputDir, 'theology-vectors-hq-compressed.json');
        const metadataFile = path.join(this.outputDir, 'theology-vectors-hq-metadata.json');
        const qualityReportFile = path.join(this.outputDir, 'quality-report.json');
        
        console.log('💾 保存高品質向量資料...');
        
        // 保存完整版本
        await fs.writeFile(outputFile, JSON.stringify(this.vectorData, null, 2));
        console.log(`✅ 完整高品質向量資料已保存: ${outputFile}`);
        
        // 保存壓縮版本
        await fs.writeFile(compressedFile, JSON.stringify(this.vectorData));
        console.log(`✅ 壓縮高品質向量資料已保存: ${compressedFile}`);
        
        // 保存元數據
        const metadata = {
            version: this.vectorData.version,
            createdAt: this.vectorData.createdAt,
            model: this.vectorData.model,
            dimensions: this.vectorData.dimensions,
            qualitySettings: this.vectorData.qualitySettings,
            totalFiles: this.vectorData.totalFiles,
            totalChunks: this.vectorData.totalChunks,
            qualityStats: this.vectorData.qualityStats,
            metadata: this.vectorData.metadata,
            processingStats: {
                totalFiles: this.progress.totalFiles,
                processedFiles: this.progress.processedFiles,
                totalChunks: this.progress.totalChunks,
                processedChunks: this.progress.processedChunks,
                semanticValidations: this.progress.semanticValidations,
                processingTime: Date.now() - this.progress.startTime
            }
        };
        
        await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
        console.log(`✅ 高品質元數據已保存: ${metadataFile}`);
        
        // 生成品質報告
        const qualityReport = this.generateQualityReport();
        await fs.writeFile(qualityReportFile, JSON.stringify(qualityReport, null, 2));
        console.log(`✅ 品質報告已保存: ${qualityReportFile}`);
        
        // 顯示文件大小
        const stats = await fs.stat(compressedFile);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📊 高品質壓縮文件大小: ${sizeMB} MB`);
        
        return {
            complete: outputFile,
            compressed: compressedFile,
            metadata: metadataFile,
            qualityReport: qualityReportFile,
            sizeMB: sizeMB
        };
    }
    
    generateQualityReport() {
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
            qualityMetrics: {
                highQualityChunks: this.vectorData.qualityStats.highQualityChunks,
                mediumQualityChunks: this.vectorData.qualityStats.mediumQualityChunks,
                lowQualityChunks: this.vectorData.qualityStats.lowQualityChunks,
                rejectedChunks: this.vectorData.qualityStats.rejectedChunks,
                qualityDistribution: {
                    high: ((this.vectorData.qualityStats.highQualityChunks / this.vectorData.totalChunks) * 100).toFixed(1) + '%',
                    medium: ((this.vectorData.qualityStats.mediumQualityChunks / this.vectorData.totalChunks) * 100).toFixed(1) + '%',
                    low: ((this.vectorData.qualityStats.lowQualityChunks / this.vectorData.totalChunks) * 100).toFixed(1) + '%'
                }
            },
            performance: {
                filesPerMinute: (this.progress.processedFiles / processingMinutes).toFixed(1),
                chunksPerMinute: (this.progress.processedChunks / processingMinutes).toFixed(1),
                semanticValidationsPerMinute: (this.progress.semanticValidations / processingMinutes).toFixed(1),
                totalProcessingTime: `${processingMinutes} 分鐘`
            },
            qualitySettings: this.vectorData.qualitySettings
        };
        
        console.log('\n📊 高品質處理統計報告:');
        console.log(`📁 總文件數: ${report.summary.totalFiles}`);
        console.log(`📚 總片段數: ${report.summary.totalChunks}`);
        console.log(`📈 平均片段/文件: ${report.summary.avgChunksPerFile}`);
        console.log(`⏱️  處理時間: ${report.performance.totalProcessingTime}`);
        console.log(`🚀 處理速度: ${report.performance.filesPerMinute} 文件/分鐘`);
        console.log(`✅ 語義驗證: ${this.progress.semanticValidations} 次`);
        
        console.log('\n🎯 品質分布:');
        console.log(`🟢 高品質: ${report.qualityMetrics.qualityDistribution.high}`);
        console.log(`🟡 中等品質: ${report.qualityMetrics.qualityDistribution.medium}`);
        console.log(`🔴 低品質: ${report.qualityMetrics.qualityDistribution.low}`);
        console.log(`❌ 被拒絕: ${report.qualityMetrics.rejectedChunks} 個`);
        
        return report;
    }
}

async function main() {
    const preprocessor = new HighQualityVectorPreprocessor();
    
    try {
        console.log('🎯 開始高品質向量資料預處理...');
        console.log('📋 目標：高品質處理 1321 個神學文件並生成精確的向量資料');
        
        // 初始化
        await preprocessor.initialize();
        
        // 處理所有文件
        await preprocessor.processAllFiles();
        
        // 保存向量資料
        const savedFiles = await preprocessor.saveVectorData();
        
        // 生成報告
        const report = preprocessor.generateQualityReport();
        
        console.log('\n🎉 高品質本地向量資料預處理完成！');
        console.log(`📁 保存位置: ${preprocessor.outputDir}`);
        console.log(`💾 文件大小: ${savedFiles.sizeMB} MB`);
        console.log(`📊 處理統計: ${report.summary.totalFiles} 個文件，${report.summary.totalChunks} 個高品質片段`);
        
        console.log('\n📋 下一步：');
        console.log('1. 將生成的高品質向量資料複製到您的應用程式');
        console.log('2. 更新 vectorService.js 以載入高品質向量資料');
        console.log('3. 享受高品質且快速的神學知識庫！');
        
    } catch (error) {
        console.error('❌ 高品質預處理失敗:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = HighQualityVectorPreprocessor; 