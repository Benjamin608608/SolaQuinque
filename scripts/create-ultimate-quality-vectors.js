#!/usr/bin/env node

/**
 * 終極品質向量資料預處理腳本
 * 
 * 使用 OpenAI text-embedding-3-large 模型
 * 最高品質設置，結果保存到桌面
 * 
 * 使用方法：
 * node scripts/create-ultimate-quality-vectors.js
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const OpenAI = require('openai');
const fetch = require('node-fetch');

class UltimateQualityVectorPreprocessor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // 本地資料夾路徑
        this.sourceFolderPath = '/Users/benjamin/Desktop/所有CCEL書籍TXT';
        this.outputDir = '/Users/benjamin/Desktop/所有CCEL書籍TXT';
        this.tempDir = path.join(__dirname, '../data/temp-ultimate');
        this.logDir = path.join(this.outputDir, 'logs');
        
        // 終極品質向量資料結構
        this.vectorData = {
            version: '4.0.0',
            createdAt: new Date().toISOString(),
            model: 'text-embedding-3-large',
            dimensions: 3072,
            qualitySettings: {
                chunkSize: 2500, // 更大的語義片段
                overlap: 400, // 更多的重疊
                minChunkLength: 150, // 最小片段長度
                maxChunkLength: 5000, // 最大片段長度
                semanticValidation: true,
                contextPreservation: true,
                theologicalTermDetection: true,
                qualityThreshold: 60, // 降低品質閾值，保留更多內容
                preserveAllContent: true, // 新增：保留所有內容選項
                qualityMode: 'balanced' // 新增：品質模式選擇
            },
            totalFiles: 0,
            totalChunks: 0,
            qualityStats: {
                highQualityChunks: 0,
                mediumQualityChunks: 0,
                lowQualityChunks: 0,
                rejectedChunks: 0,
                theologicalTermsFound: 0,
                semanticValidations: 0
            },
            chunks: [],
            metadata: {
                description: '終極品質神學知識庫向量資料',
                source: '本地 CCEL 書籍 TXT 文件',
                processingDate: new Date().toISOString(),
                qualityFocus: '最高語義準確性和神學完整性',
                model: 'text-embedding-3-large',
                dimensions: 3072
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
            semanticValidations: 0,
            theologicalTermChecks: 0
        };
    }
    
    async initialize() {
        console.log('🚀 初始化終極品質向量資料預處理器...');
        
        // 檢查必要的環境變數
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('❌ 缺少 OPENAI_API_KEY 環境變數');
        }
        
        // 檢查本地資料夾是否存在
        try {
            await fs.access(this.sourceFolderPath);
            console.log(`✅ 找到本地資料夾: ${this.sourceFolderPath}`);
        } catch (error) {
            throw new Error(`❌ 找不到本地資料夾: ${this.sourceFolderPath}`);
        }
        
        // 創建必要的目錄
        await fs.mkdir(this.outputDir, { recursive: true });
        await fs.mkdir(this.tempDir, { recursive: true });
        await fs.mkdir(this.logDir, { recursive: true });
        
        console.log('✅ 終極品質預處理器初始化完成');
        console.log(`📁 本地資料夾: ${this.sourceFolderPath}`);
        console.log(`📁 輸出目錄: ${this.outputDir}`);
        console.log(`📁 臨時目錄: ${this.tempDir}`);
        console.log(`📁 日誌目錄: ${this.logDir}`);
        
        // 顯示終極品質設置
        console.log('\n🎯 終極品質設置：');
        console.log(`📏 片段大小: ${this.vectorData.qualitySettings.chunkSize} 字符`);
        console.log(`🔄 重疊大小: ${this.vectorData.qualitySettings.overlap} 字符`);
        console.log(`🤖 嵌入模型: ${this.vectorData.model}`);
        console.log(`📐 向量維度: ${this.vectorData.dimensions}`);
        console.log(`✅ 語義驗證: 啟用`);
        console.log(`✅ 上下文保留: 啟用`);
        console.log(`✅ 神學術語檢測: 啟用`);
        console.log(`🎯 品質閾值: ${this.vectorData.qualitySettings.qualityThreshold}%`);
    }
    
    // 終極品質文本分割
    splitTextIntoUltimateChunks(text, fileName) {
        console.log(`📚 終極品質文本分割: ${fileName}`);
        
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
                        const chunk = this.createUltimateChunk(currentChunk.trim(), fileName, chunkCount++);
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
                    const chunk = this.createUltimateChunk(currentChunk.trim(), fileName, chunkCount++);
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
            const chunk = this.createUltimateChunk(currentChunk.trim(), fileName, chunkCount++);
            if (chunk) chunks.push(chunk);
        }
        
        console.log(`✅ 生成 ${chunks.length} 個終極品質片段`);
        return chunks;
    }
    
    // 智能句子分割
    splitIntoSentences(text) {
        // 更精確的句子分割，考慮神學文本的特殊性
        const sentencePattern = /[。！？；\n]+/;
        return text.split(sentencePattern).filter(s => s.trim().length > 0);
    }
    
    // 創建終極品質片段
    createUltimateChunk(text, fileName, chunkId) {
        const settings = this.vectorData.qualitySettings;
        
        // 品質檢查
        if (text.length < settings.minChunkLength) {
            console.log(`⚠️  片段太短，跳過: ${text.length} 字符`);
            this.vectorData.qualityStats.rejectedChunks++;
            return null;
        }
        
        if (text.length > settings.maxChunkLength) {
            console.log(`⚠️  片段太長，需要進一步分割: ${text.length} 字符`);
            this.vectorData.qualityStats.rejectedChunks++;
            return null;
        }
        
        // 終極品質評估
        const qualityScore = this.assessUltimateChunkQuality(text);
        
        // 根據品質模式決定是否保留片段
        let shouldKeep = true;
        let keepReason = '';
        
        if (settings.preserveAllContent) {
            // 保留所有內容模式：只過濾掉明顯無用的片段
            shouldKeep = qualityScore >= 30; // 只過濾掉品質極低的片段
            keepReason = '保留所有內容模式';
        } else if (settings.qualityMode === 'strict') {
            // 嚴格品質模式：只保留高品質片段
            shouldKeep = qualityScore >= settings.qualityThreshold;
            keepReason = '嚴格品質模式';
        } else if (settings.qualityMode === 'balanced') {
            // 平衡模式：保留大部分內容，但標記品質
            shouldKeep = qualityScore >= 40; // 較寬鬆的閾值
            keepReason = '平衡品質模式';
        } else {
            // 默認：使用設定的閾值
            shouldKeep = qualityScore >= settings.qualityThreshold;
            keepReason = '默認品質模式';
        }
        
        if (!shouldKeep) {
            console.log(`⚠️  片段品質不足，跳過: ${qualityScore}分 (${keepReason})`);
            this.vectorData.qualityStats.rejectedChunks++;
            return null;
        }
        
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
                theologicalTermCount: this.countTheologicalTerms(text),
                contextCompleteness: this.assessContextCompleteness(text),
                semanticIntegrity: this.assessSemanticIntegrity(text),
                keepReason: keepReason // 新增：保留原因
            },
            metadata: {
                createdAt: new Date().toISOString(),
                processingVersion: '4.0.0',
                model: 'text-embedding-3-large'
            }
        };
        
        // 更新品質統計
        const level = chunk.quality.level;
        if (level === 'high') this.vectorData.qualityStats.highQualityChunks++;
        else if (level === 'medium') this.vectorData.qualityStats.mediumQualityChunks++;
        else this.vectorData.qualityStats.lowQualityChunks++;
        
        // 更新神學術語統計
        if (chunk.quality.hasTheologicalTerms) {
            this.vectorData.qualityStats.theologicalTermsFound++;
        }
        
        return chunk;
    }
    
    // 終極品質評估
    assessUltimateChunkQuality(text) {
        let score = 0;
        
        // 1. 長度評分 (0-25分)
        const length = text.length;
        if (length >= 800 && length <= 2500) score += 25;
        else if (length >= 400 && length < 800) score += 20;
        else if (length >= 150 && length < 400) score += 15;
        
        // 2. 神學術語評分 (0-30分)
        const theologicalTerms = this.countTheologicalTerms(text);
        if (theologicalTerms >= 5) score += 30;
        else if (theologicalTerms >= 3) score += 25;
        else if (theologicalTerms >= 1) score += 20;
        
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
            '天國', '地獄', '審判', '復活', '永生', '十字架', '寶血', '贖罪',
            '聖父', '聖子', '聖靈', '道成肉身', '救贖', '和好', '稱義',
            '聖禮', '洗禮', '聖餐', '按手', '奉獻', '敬拜', '禱告', '讚美'
        ];
        
        return theologicalTerms.some(term => text.includes(term));
    }
    
    // 計算神學術語數量
    countTheologicalTerms(text) {
        const theologicalTerms = [
            '上帝', '神', '耶穌', '基督', '聖靈', '三位一體', '救恩', '原罪',
            '教會', '聖經', '福音', '信仰', '恩典', '信心', '愛', '公義',
            '聖潔', '憐憫', '寬恕', '悔改', '重生', '成聖', '榮耀', '永恆',
            '天國', '地獄', '審判', '復活', '永生', '十字架', '寶血', '贖罪',
            '聖父', '聖子', '聖靈', '道成肉身', '救贖', '和好', '稱義',
            '聖禮', '洗禮', '聖餐', '按手', '奉獻', '敬拜', '禱告', '讚美'
        ];
        
        return theologicalTerms.filter(term => text.includes(term)).length;
    }
    
    // 檢查語義完整性
    isSemanticallyComplete(text) {
        const sentences = text.split(/[。！？]/);
        const completeSentences = sentences.filter(s => s.trim().length > 15);
        return completeSentences.length >= 3;
    }
    
    // 檢查部分語義內容
    hasPartialSemanticContent(text) {
        return text.includes('。') || text.includes('！') || text.includes('？');
    }
    
    // 檢查上下文連貫性
    isContextuallyCoherent(text) {
        const connectors = ['因此', '所以', '然而', '但是', '而且', '並且', '因為', '由於', '既然', '雖然', '儘管'];
        return connectors.some(connector => text.includes(connector));
    }
    
    // 檢查部分上下文
    hasSomeContext(text) {
        return text.length > 300;
    }
    
    // 評估上下文完整性
    assessContextCompleteness(text) {
        if (text.length > 1000) return 'high';
        else if (text.length > 500) return 'medium';
        else return 'low';
    }
    
    // 評估語義完整性
    assessSemanticIntegrity(text) {
        const sentences = text.split(/[。！？]/);
        const completeSentences = sentences.filter(s => s.trim().length > 10);
        const ratio = completeSentences.length / sentences.length;
        
        if (ratio >= 0.8) return 'high';
        else if (ratio >= 0.6) return 'medium';
        else return 'low';
    }
    
    // 獲取品質等級
    getQualityLevel(score) {
        if (score >= 85) return 'high';
        else if (score >= 70) return 'medium';
        else return 'low';
    }
    
    // 終極語義驗證
    async validateChunkSemantics(chunk) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
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
5. 教義完整性

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
            return 5;
        }
    }
    
    // 生成終極品質嵌入向量
    async generateUltimateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-large',
                input: text,
                dimensions: 3072
            });
            
            return response.data[0].embedding;
        } catch (error) {
            console.error(`❌ 生成終極嵌入向量失敗: ${error.message}`);
            throw error;
        }
    }
    
    // 批量生成終極品質嵌入向量
    async generateUltimateEmbeddings(chunks) {
        console.log(`🔄 開始生成 ${chunks.length} 個終極品質嵌入向量...`);
        
        const BATCH_SIZE = 20; // 較小的批次以確保品質
        const embeddings = [];
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
            
            console.log(`📦 處理終極品質批次 ${batchNum}/${totalBatches} (${batch.length} 個片段)`);
            
            try {
                // 並行處理當前批次的嵌入向量
                const batchPromises = batch.map(async (chunk, index) => {
                    try {
                        // 語義驗證
                        const semanticScore = await this.validateChunkSemantics(chunk);
                        chunk.quality.semanticValidationScore = semanticScore;
                        
                        // 生成嵌入向量
                        const embedding = await this.generateUltimateEmbedding(chunk.text);
                        
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
                console.log(`📈 終極品質嵌入向量進度: ${progress}% (${this.progress.processedChunks}/${chunks.length})`);
                
                // 批次間休息，確保品質
                if (i + BATCH_SIZE < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                
            } catch (error) {
                console.error(`❌ 終極品質批次 ${batchNum} 處理失敗:`, error.message);
            }
        }
        
        console.log(`✅ 成功生成 ${embeddings.length} 個終極品質嵌入向量`);
        return embeddings;
    }
    
    // 列出本地資料夾中的所有 TXT 文件
    async listLocalTxtFiles() {
        console.log(`📋 列出本地資料夾中的 TXT 文件: ${this.sourceFolderPath}`);
        
        try {
            const files = await fs.readdir(this.sourceFolderPath);
            const txtFiles = files.filter(file => 
                file.toLowerCase().endsWith('.txt') && 
                !file.startsWith('.') // 排除隱藏文件
            );
            
            console.log(`✅ 找到 ${files.length} 個文件，其中 ${txtFiles.length} 個是 TXT 文件`);
            
            return txtFiles.map(file => ({
                name: file,
                path: path.join(this.sourceFolderPath, file)
            }));
            
        } catch (error) {
            throw new Error(`讀取本地資料夾失敗: ${error.message}`);
        }
    }
    
    // 讀取本地文件
    async readLocalFile(filePath, fileName) {
        console.log(`📖 讀取文件: ${fileName}`);
        
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            console.log(`✅ 文件讀取完成: ${fileName} (${content.length} 字符)`);
            return content;
        } catch (error) {
            throw new Error(`讀取文件失敗 ${fileName}: ${error.message}`);
        }
    }
    
    async processAllFiles() {
        console.log('📋 開始終極品質處理所有本地文件...');
        
        // 1. 列出所有文件
        const files = await this.listLocalTxtFiles();
        this.vectorData.totalFiles = files.length;
        this.progress.totalFiles = files.length;
        
        if (files.length === 0) {
            throw new Error('❌ 沒有找到任何 .txt 文件');
        }
        
        console.log(`🎯 目標：終極品質處理 ${files.length} 個本地 TXT 文件`);
        
        // 2. 處理文件
        let allChunks = [];
        
        console.log(`🔄 開始終極品質處理 ${files.length} 個文件...`);
        
        for (const file of files) {
            try {
                this.progress.processedFiles++;
                console.log(`\n📁 終極品質處理文件 ${this.progress.processedFiles}/${files.length}: ${file.name}`);
                
                // 讀取文件內容
                const content = await this.readLocalFile(file.path, file.name);
                
                // 終極品質分割成片段
                const chunks = this.splitTextIntoUltimateChunks(content, file.name);
                console.log(`📚 提取了 ${chunks.length} 個終極品質文本片段`);
                
                allChunks.push(...chunks);
                
                // 進度報告
                if (this.progress.processedFiles % 5 === 0) {
                    console.log(`📊 已處理 ${this.progress.processedFiles}/${files.length} 個文件，累計 ${allChunks.length} 個終極品質片段`);
                }
                
            } catch (error) {
                console.error(`❌ 終極品質處理文件 ${file.name} 失敗:`, error.message);
                continue;
            }
        }
        
        this.vectorData.totalChunks = allChunks.length;
        this.progress.totalChunks = allChunks.length;
        
        console.log(`\n🎉 終極品質文件處理完成！`);
        console.log(`📊 處理了 ${this.progress.processedFiles} 個文件，提取了 ${allChunks.length} 個終極品質文本片段`);
        
        // 3. 生成終極品質嵌入向量
        const processedChunks = await this.generateUltimateEmbeddings(allChunks);
        this.vectorData.chunks = processedChunks;
        
        console.log(`✅ 終極品質向量處理完成！`);
        console.log(`📊 成功處理 ${processedChunks.length} 個終極品質向量片段`);
    }
    
    async saveVectorData() {
        const outputFile = path.join(this.outputDir, 'theology-vectors-ultimate-complete.json');
        const compressedFile = path.join(this.outputDir, 'theology-vectors-ultimate-compressed.json');
        const metadataFile = path.join(this.outputDir, 'theology-vectors-ultimate-metadata.json');
        const qualityReportFile = path.join(this.outputDir, 'ultimate-quality-report.json');
        
        console.log('💾 保存終極品質向量資料...');
        
        // 保存完整版本
        await fs.writeFile(outputFile, JSON.stringify(this.vectorData, null, 2));
        console.log(`✅ 完整終極品質向量資料已保存: ${outputFile}`);
        
        // 保存壓縮版本
        await fs.writeFile(compressedFile, JSON.stringify(this.vectorData));
        console.log(`✅ 壓縮終極品質向量資料已保存: ${compressedFile}`);
        
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
        console.log(`✅ 終極品質元數據已保存: ${metadataFile}`);
        
        // 生成品質報告
        const qualityReport = this.generateUltimateQualityReport();
        await fs.writeFile(qualityReportFile, JSON.stringify(qualityReport, null, 2));
        console.log(`✅ 終極品質報告已保存: ${qualityReportFile}`);
        
        // 顯示文件大小
        const stats = await fs.stat(compressedFile);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📊 終極品質壓縮文件大小: ${sizeMB} MB`);
        
        return {
            complete: outputFile,
            compressed: compressedFile,
            metadata: metadataFile,
            qualityReport: qualityReportFile,
            sizeMB: sizeMB
        };
    }
    
    generateUltimateQualityReport() {
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
                theologicalTermsFound: this.vectorData.qualityStats.theologicalTermsFound,
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
        
        console.log('\n📊 終極品質處理統計報告:');
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
        console.log(`📖 神學術語: ${report.qualityMetrics.theologicalTermsFound} 個片段包含神學術語`);
        
        return report;
    }
}

async function main() {
    const preprocessor = new UltimateQualityVectorPreprocessor();
    
    try {
        console.log('🎯 開始終極品質向量資料預處理...');
        console.log('📋 目標：使用 text-embedding-3-large 模型處理本地 CCEL 書籍 TXT 文件');
        console.log('💾 結果將保存到: /Users/benjamin/Desktop/所有CCEL書籍TXT/');
        
        // 初始化
        await preprocessor.initialize();
        
        // 處理所有文件
        await preprocessor.processAllFiles();
        
        // 保存向量資料
        const savedFiles = await preprocessor.saveVectorData();
        
        // 生成報告
        const report = preprocessor.generateUltimateQualityReport();
        
        console.log('\n🎉 終極品質本地向量資料預處理完成！');
        console.log(`📁 保存位置: ${preprocessor.outputDir}`);
        console.log(`💾 文件大小: ${savedFiles.sizeMB} MB`);
        console.log(`📊 處理統計: ${report.summary.totalFiles} 個文件，${report.summary.totalChunks} 個終極品質片段`);
        
        console.log('\n📋 生成的文件：');
        console.log(`📄 完整向量資料: ${savedFiles.complete}`);
        console.log(`📄 壓縮向量資料: ${savedFiles.compressed}`);
        console.log(`📄 元數據: ${savedFiles.metadata}`);
        console.log(`📄 品質報告: ${savedFiles.qualityReport}`);
        
        console.log('\n🎯 下一步：');
        console.log('1. 將向量資料整合到您的應用程式');
        console.log('2. 更新 vectorService.js 以載入終極品質向量資料');
        console.log('3. 享受最高品質的神學知識庫！');
        
    } catch (error) {
        console.error('❌ 終極品質預處理失敗:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = UltimateQualityVectorPreprocessor; 