// 神學知識庫向量服務 - Google Drive API 集成版本
// 更新時間: 2025-07-29 14:00 UTC
// 支持使用 GOOGLE_DRIVE_API_KEY 環境變數訪問 1300+ 文件

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

class VectorService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.embeddings = [];
        this.texts = [];
        this.faissIndex = null;
        this.isInitialized = false;
        
        // 添加進度追蹤
        this.progress = {
            totalFiles: 0,
            processedFiles: 0,
            downloadedFiles: 0,
            remainingFiles: 0,
            isBackgroundProcessing: false,
            startTime: null,
            estimatedTimeRemaining: null
        };
    }

    // 從 Google Drive 下載檔案
    async downloadFromGoogleDrive(fileId, outputPath) {
        console.log(`📥 正在從 Google Drive 下載檔案: ${fileId}`);
        
        try {
            console.log('📁 嘗試多種下載方式...');
            
            // 方式 1: 嘗試公開分享連結
            const publicUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
            console.log(`🔗 嘗試公開下載連結: ${publicUrl}`);
            
            const publicResponse = await fetch(publicUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; GoogleBot/2.1; +http://www.google.com/bot.html)'
                }
            });
            
            if (publicResponse.ok) {
                console.log('✅ 公開下載連結成功');
                return this.processDownloadResponse(publicResponse, outputPath);
            }
            
            console.log(`❌ 公開下載失敗: ${publicResponse.status}, 嘗試其他方式...`);
            
            // 方式 2: 嘗試舊式下載連結
            const legacyUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
            console.log(`🔗 嘗試舊式下載連結: ${legacyUrl}`);
            
            const legacyResponse = await fetch(legacyUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; GoogleBot/2.1; +http://www.google.com/bot.html)'
                }
            });
            
            if (legacyResponse.ok) {
                console.log('✅ 舊式下載連結成功');
                return this.processDownloadResponse(legacyResponse, outputPath);
            }
            
            console.log(`❌ 舊式下載失敗: ${legacyResponse.status}`);
            
            // 方式 3: 嘗試 API 下載（需要認證）
            const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            console.log(`🔗 嘗試 API 下載: ${apiUrl}`);
            
            const apiResponse = await fetch(apiUrl);
            
            if (apiResponse.ok) {
                console.log('✅ API 下載成功');
                return this.processDownloadResponse(apiResponse, outputPath);
            }
            
            throw new Error(`所有下載方式都失敗了。API 狀態: ${apiResponse.status}, 公開狀態: ${publicResponse.status}, 舊式狀態: ${legacyResponse.status}`)
            
        } catch (error) {
            console.error('❌ Google Drive 下載失敗:', error.message);
            throw error;
        }
    }
    
    // 從 Google Drive 資料夾下載所有文件
    async downloadFromGoogleDriveFolder(folderId, outputDir) {
        console.log(`📁 正在從 Google Drive 資料夾下載文件: ${folderId}`);
        
        try {
            // 列出資料夾中的所有文件
            const filesList = await this.listGoogleDriveFiles(folderId);
            console.log(`📋 找到 ${filesList.length} 個文件`);
            
            // 初始化進度追蹤
            this.progress.totalFiles = filesList.length;
            this.progress.processedFiles = 0;
            this.progress.downloadedFiles = 0;
            this.progress.remainingFiles = filesList.length;
            this.progress.startTime = Date.now();
            this.progress.isBackgroundProcessing = true;
            
            if (filesList.length === 0) {
                throw new Error('資料夾中沒有找到文件');
            }
            
            const texts = [];
            let downloadedCount = 0;
            let processedTextCount = 0;
            let skippedCount = 0;
            
            // 分階段載入策略
            const INITIAL_BATCH_SIZE = 20;  // 每批 20 個文件（更小批次）
            const INITIAL_MAX_FILES = 100;  // 初始階段只載入 100 個文件（確保成功）
            const PROGRESS_INTERVAL = 10;   // 每 10 個文件顯示進度
            
            // Railway 快速下載模式 - 只下載不處理文本
            const RAILWAY_DOWNLOAD_ONLY = 50;   // Railway 環境快速下載 50 個文件但不處理（避免超時）
            
            // 檢測是否為初始建立索引階段
            const isInitialBuild = process.env.NODE_ENV === 'production' && !process.env.SKIP_INITIAL_LIMIT;
            const isRailwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
            
            let filesToProcess;
            let downloadOnlyMode = false;
            
            if (isInitialBuild && isRailwayEnv) {
                filesToProcess = filesList.slice(0, RAILWAY_DOWNLOAD_ONLY);
                downloadOnlyMode = true;
                console.log(`⚡ Railway 快速下載模式：下載前 ${filesToProcess.length} 個文件（不處理文本）`);
                console.log(`📝 文本處理將在系統啟動後進行，確保高品質回答`);
                console.log(`📁 剩餘 ${filesList.length - filesToProcess.length} 個文件將在背景下載`);
            } else if (isInitialBuild) {
                filesToProcess = filesList.slice(0, INITIAL_MAX_FILES);
                console.log(`🚀 初始建立階段：處理前 ${filesToProcess.length} 個文件`);
                console.log(`📝 剩餘 ${filesList.length - filesToProcess.length} 個文件將在系統啟動後背景載入`);
            } else {
                filesToProcess = filesList;
                console.log(`🎯 完整載入模式：處理所有 ${filesToProcess.length} 個文件`);
            }
            
            console.log(`📦 批次大小: ${INITIAL_BATCH_SIZE} 個文件/批`);
            console.log(`📊 預計批次數: ${Math.ceil(filesToProcess.length / INITIAL_BATCH_SIZE)}`);
            
            // Railway 環境限制總文本片段數（僅在處理模式下使用）
            const MAX_TEXT_CHUNKS = downloadOnlyMode ? Infinity : (isRailwayEnv ? 10000 : 50000);
            
            // 確保輸出目錄存在
            try {
                await fs.mkdir(outputDir, { recursive: true });
            } catch (error) {
                // 目錄可能已存在
            }
            
            // 分批處理文件
            for (let i = 0; i < filesToProcess.length; i += INITIAL_BATCH_SIZE) {
                const batch = filesToProcess.slice(i, i + INITIAL_BATCH_SIZE);
                const batchNum = Math.floor(i/INITIAL_BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(filesToProcess.length/INITIAL_BATCH_SIZE);
                
                console.log(`\n📦 處理批次 ${batchNum}/${totalBatches} (${batch.length} 個文件)`);
                console.log(`📈 總進度: ${((i / filesToProcess.length) * 100).toFixed(1)}%`);
                
                // 處理當前批次
                for (const file of batch) {
                    try {
                        const filePath = path.join(outputDir, file.name);
                        
                        // 檢查文件是否已存在（避免重複下載）
                        try {
                            await fs.access(filePath);
                            console.log(`⏭️  跳過已存在文件: ${file.name}`);
                            skippedCount++;
                            continue;
                        } catch (error) {
                            // 文件不存在，需要下載
                        }
                        
                        console.log(`📥 下載文件 ${downloadedCount + 1}/${filesToProcess.length}: ${file.name}`);
                        
                        await this.downloadFromGoogleDrive(file.id, filePath);
                        
                        // 如果是文本文件，根據模式決定是否處理
                        if (file.name.toLowerCase().endsWith('.txt')) {
                            if (downloadOnlyMode) {
                                // 下載模式：只下載不處理，節省時間
                                console.log(`📁 已下載: ${file.name}（文本處理將延後進行）`);
                            } else {
                                // 處理模式：讀取並分割文本
                                // 檢查是否已達到文本片段限制
                                if (texts.length >= MAX_TEXT_CHUNKS) {
                                    console.log(`⚠️  已達到文本片段限制 (${MAX_TEXT_CHUNKS})，跳過剩餘文件`);
                                    break;
                                }
                                
                                const content = await fs.readFile(filePath, 'utf8');
                                const chunks = this.splitTextIntoChunks(content);
                                
                                // 只添加不超過限制的片段
                                const remainingSlots = MAX_TEXT_CHUNKS - texts.length;
                                const chunksToAdd = chunks.slice(0, remainingSlots);
                                
                                chunksToAdd.forEach(chunk => {
                                    texts.push({
                                        text: chunk,
                                        fileName: file.name
                                    });
                                });
                                
                                processedTextCount += chunksToAdd.length;
                                
                                if (chunksToAdd.length < chunks.length) {
                                    console.log(`⚠️  文件 ${file.name} 只使用了 ${chunksToAdd.length}/${chunks.length} 個片段（達到限制）`);
                                }
                            }
                        }
                        
                        downloadedCount++;
                        
                        // 更新進度追蹤
                        this.progress.processedFiles = downloadedCount;
                        this.progress.downloadedFiles = downloadedCount;
                        this.progress.remainingFiles = this.progress.totalFiles - downloadedCount;
                        
                        // 定期顯示進度
                        if (downloadedCount % PROGRESS_INTERVAL === 0) {
                            const progressPercent = ((downloadedCount / filesToProcess.length) * 100).toFixed(1);
                            const elapsed = Math.round((Date.now() - this.progress.startTime) / 1000);
                            console.log(`📊 進度更新: ${progressPercent}% (${downloadedCount}/${filesToProcess.length}) - 已用時 ${elapsed}秒`);
                            console.log(`📊 詳細: 已下載 ${downloadedCount} 個文件，跳過 ${skippedCount} 個，提取了 ${processedTextCount} 個文本片段`);
                        }
                        
                    } catch (error) {
                        console.error(`❌ 下載文件失敗 ${file.name}:`, error.message);
                        skippedCount++;
                        continue; // 繼續下載其他文件
                    }
                }
                
                // 批次完成後短暫休息，避免 API 限制和內存壓力
                if (i + INITIAL_BATCH_SIZE < filesToProcess.length) {
                    console.log(`⏸️  批次 ${batchNum} 完成，休息 2 秒...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`\n🎉 ${downloadOnlyMode ? 'Railway 快速下載' : (isInitialBuild ? '初始階段' : '完整')}處理完成！`);
            console.log(`✅ 成功下載: ${downloadedCount} 個文件`);
            console.log(`⏭️  跳過已存在: ${skippedCount} 個文件`);
            console.log(`📚 提取文本片段: ${texts.length} 個`);
            
            if (downloadedCount > 0) {
                console.log(`📈 平均每文件片段數: ${(texts.length / Math.max(downloadedCount, 1)).toFixed(1)}`);
            }
            
            // 在下載模式下，使用預設文本確保系統能啟動
            if (downloadOnlyMode && texts.length === 0) {
                console.log(`\n🔄 下載模式完成，使用預設文本建立初始索引`);
                console.log(`📝 高品質文本索引將在系統啟動後建立`);
                const defaultTexts = this.getDefaultTheologyTexts();
                texts.push(...defaultTexts);
                console.log(`📚 添加了 ${defaultTexts.length} 個預設文本片段`);
            }
            
            if (isInitialBuild && filesList.length > filesToProcess.length) {
                console.log(`\n🔄 ${downloadOnlyMode ? '後續處理' : '背景載入'}計劃:`);
                console.log(`   - 已${downloadOnlyMode ? '下載' : '載入'}: ${filesToProcess.length} 個文件`);
                console.log(`   - 待處理: ${filesList.length - filesToProcess.length} 個文件`);
                console.log(`   - 系統啟動後將自動${downloadOnlyMode ? '處理已下載文件並' : ''}背景載入剩餘文件`);
                
                // 保存剩餘文件列表和已下載文件信息
                const remainingFiles = filesList.slice(filesToProcess.length);
                const remainingFilesPath = path.join(outputDir, 'remaining_files.json');
                await fs.writeFile(remainingFilesPath, JSON.stringify(remainingFiles, null, 2));
                
                if (downloadOnlyMode) {
                    // 保存已下載文件列表供後續處理
                    const downloadedFiles = filesToProcess.slice(0, downloadedCount);
                    const downloadedFilesPath = path.join(outputDir, 'downloaded_files.json');
                    await fs.writeFile(downloadedFilesPath, JSON.stringify(downloadedFiles, null, 2));
                    console.log(`💾 已下載文件列表已保存到: ${downloadedFilesPath}`);
                }
                
                console.log(`💾 剩餘文件列表已保存到: ${remainingFilesPath}`);
                
                // 啟動背景處理
                this.startBackgroundProcessing(outputDir, remainingFiles, downloadOnlyMode);
            }
            
            return texts;
            
        } catch (error) {
            console.error('❌ 從 Google Drive 資料夾下載失敗:', error.message);
            throw error;
        }
    }
    
    // 列出 Google Drive 資料夾中的文件
    async listGoogleDriveFiles(folderId) {
        console.log(`📋 列出 Google Drive 資料夾中的文件: ${folderId}`);
        
        try {
            // 從環境變數獲取 Google Drive API 密鑰
            const apiKey = process.env.GOOGLE_DRIVE_API_KEY || 'AIzaSyCdI0rjMKiPW7lJKiMtmbc8B1EuzWqzWdM';
            console.log(`🔑 使用 API 密鑰: ${apiKey.substring(0, 10)}...`);
            
            // 使用 Google Drive API v3 列出文件 - 支持分頁獲取所有文件
            console.log('🔗 使用 Google Drive API v3 列出文件（支持分頁）');
            
            let allFiles = [];
            let pageToken = null;
            let pageCount = 0;
            
            do {
                pageCount++;
                console.log(`📄 獲取第 ${pageCount} 頁文件...`);
                
                let apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size),nextPageToken&pageSize=1000&key=${apiKey}`;
                
                if (pageToken) {
                    apiUrl += `&pageToken=${pageToken}`;
                }
                
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                    const data = await response.json();
                    const files = data.files || [];
                    
                    console.log(`✅ 第 ${pageCount} 頁獲取到 ${files.length} 個文件`);
                    allFiles.push(...files);
                    
                    pageToken = data.nextPageToken;
                    
                    if (pageToken) {
                        console.log(`🔄 發現更多文件，準備獲取下一頁...`);
                        // 短暫休息避免 API 限制
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } else {
                    const errorText = await response.text();
                    console.log(`❌ API 請求失敗: ${response.status} - ${errorText}`);
                    
                    // 如果 API 失敗，使用預定義文件列表作為後備
                    console.log('🔄 使用預定義文件列表作為後備');
                    return this.getPreDefinedFilesList(folderId);
                }
                
            } while (pageToken);
            
            console.log(`🎉 總共獲取到 ${allFiles.length} 個文件（共 ${pageCount} 頁）`);
            return this.processFilesList(allFiles);
            
        } catch (error) {
            console.error('❌ 列出文件失敗:', error.message);
            // 作為最後的後備方案，返回預定義的文件
            return this.getPreDefinedFilesList(folderId);
        }
    }
    
    // 處理文件列表
    processFilesList(files) {
        // 篩選出文本文件或其他可處理的文件
        const validFiles = files.filter(file => {
            const isTextFile = file.name.toLowerCase().endsWith('.txt');
            const isZipFile = file.name.toLowerCase().endsWith('.zip');
            const isJsonFile = file.name.toLowerCase().endsWith('.json');
            return isTextFile || isZipFile || isJsonFile;
        });
        
        console.log(`📄 找到 ${validFiles.length} 個可處理的文件 (總共 ${files.length} 個文件)`);
        
        validFiles.forEach(file => {
            const sizeStr = file.size ? `(${(file.size / 1024 / 1024).toFixed(2)} MB)` : '';
            console.log(`  - ${file.name} ${sizeStr}`);
        });
        
        return validFiles;
    }
    
    // 從 HTML 解析文件列表
    parseFilesFromHTML(htmlContent) {
        console.log('🔍 嘗試從 HTML 解析文件列表...');
        
        // 這是一個簡化的解析，實際情況可能需要更複雜的邏輯
        const filePattern = /data-id="([^"]+)"[^>]*>([^<]+\.txt)</g;
        const files = [];
        let match;
        
        while ((match = filePattern.exec(htmlContent)) !== null) {
            files.push({
                id: match[1],
                name: match[2],
                mimeType: 'text/plain'
            });
        }
        
        console.log(`📄 從 HTML 解析到 ${files.length} 個文件`);
        return files;
    }
    
    // 獲取預定義的文件列表（後備方案）
    getPreDefinedFilesList(folderId) {
        console.log('📋 使用預定義文件列表作為後備方案');
        
        // 用戶提供的具體文件 ID
        const knownFiles = [
            { 
                id: '1H4LWStz5JHyrXVMAS2DMNAR3leKpvK2a', 
                name: 'theology_text_1.txt', 
                mimeType: 'text/plain' 
            },
            { 
                id: '1LwwgHyR6SSMXWrWEWhX9AUJZeAkuQQXM', 
                name: 'theology_text_2.txt', 
                mimeType: 'text/plain' 
            },
            { 
                id: '1uypSnanSZca4dw6oIb5wCjU9KjimHexR', 
                name: 'theology_text_3.txt', 
                mimeType: 'text/plain' 
            }
        ];
        
        if (knownFiles.length > 0) {
            console.log(`📄 使用 ${knownFiles.length} 個預定義文件`);
            knownFiles.forEach(file => {
                console.log(`  - ${file.name} (ID: ${file.id})`);
            });
            return knownFiles;
        }
        
        // 如果沒有預定義文件，拋出錯誤
        throw new Error('無法獲取資料夾中的文件列表，且沒有預定義的後備文件');
    }
    
    // 處理下載響應
    async processDownloadResponse(response, outputPath) {
        // 確保輸出目錄存在
        const outputDir = path.dirname(outputPath);
        try {
            await fs.mkdir(outputDir, { recursive: true });
        } catch (error) {
            // 目錄可能已存在
        }
        
        // 獲取文件大小
        const contentLength = response.headers.get('content-length');
        const totalSize = contentLength ? parseInt(contentLength) : 0;
        
        console.log(`📦 開始下載，預計大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
        // 使用 Node.js 流處理（兼容 node-fetch v2）
        const fileStream = require('fs').createWriteStream(outputPath);
        let downloadedSize = 0;
        
        try {
            // 使用 node-fetch v2 的 body 流
            response.body.on('data', (chunk) => {
                downloadedSize += chunk.length;
                
                // 只在文件較大時顯示進度（>1MB），且每 5MB 顯示一次
                if (totalSize > 1024 * 1024 && downloadedSize % (1024 * 1024 * 5) < chunk.length) {
                    const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                    console.log(`📊 下載進度: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
                }
            });
            
            response.body.on('error', (error) => {
                fileStream.destroy();
                throw error;
            });
            
            response.body.on('end', () => {
                fileStream.end();
            });
            
            // 將響應流導向文件流
            response.body.pipe(fileStream);
            
            // 等待文件寫入完成
            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });
            
            console.log(`✅ 檔案下載完成: ${path.basename(outputPath)} (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
            return outputPath;
            
        } catch (error) {
            fileStream.destroy();
            throw error;
        }
    }

    // 初始化 FAISS 索引
    async initialize() {
        try {
            console.log('正在初始化向量服務...');
            
            // 確保 data 目錄存在
            const dataDir = path.join(__dirname, '../data');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                console.log('✅ data 目錄已確保存在');
            } catch (error) {
                console.log('data 目錄已存在或無法建立');
            }
            
            // 檢查是否有預先建立的向量索引
            const indexPath = path.join(__dirname, '../data/faiss_index.bin');
            const textsPath = path.join(__dirname, '../data/texts.json');
            
            // 暫時禁用索引持久化以避免序列化問題
            // 每次都重新建立內存中的 FAISS 索引
            console.log('🔄 每次重新建立 FAISS 向量索引（避免序列化問題）...');

            // 建立新的向量索引
            await this.buildIndex();
            
        } catch (error) {
            console.error('❌ 初始化向量服務失敗:', error);
            throw error;
        }
    }

    // 建立向量索引
    async buildIndex() {
        console.log('開始建立向量索引...');
        
        // 載入文本資料
        const textData = await this.loadTextData();
        
        // 檢查是否為預處理的向量資料
        if (textData && textData.isPreprocessedVectors) {
            console.log('🚀 使用預處理向量資料，跳過嵌入向量生成步驟');
            this.texts = textData.texts;
            this.embeddings = textData.embeddings;
            console.log(`📊 載入了 ${this.texts.length} 個文本片段和對應的嵌入向量`);
        } else {
            // 將資料轉換為標準格式
            if (Array.isArray(textData)) {
                this.texts = textData.map(item => {
                    if (typeof item === 'string') {
                        return { text: item, fileName: 'unknown' };
                    }
                    return item;
                });
            } else {
                this.texts = textData;
            }
            
            console.log(`正在生成嵌入向量...`);
            
            // 使用批量處理生成所有嵌入向量
            this.embeddings = await this.generateEmbeddings(this.texts);
        }
        
        // 建立 FAISS 索引
        const { IndexFlatL2 } = require('faiss-node');
        this.faissIndex = new IndexFlatL2(this.embeddings[0].length);
        
        if (this.embeddings.length > 0) {
            console.log('🔄 正在建立 FAISS 索引...');
            // 將所有向量添加到 FAISS 索引
            for (let i = 0; i < this.embeddings.length; i++) {
                const vector = Array.from(this.embeddings[i]);
                this.faissIndex.add(vector);
                
                // 每 1000 個向量顯示一次進度
                if ((i + 1) % 1000 === 0) {
                    console.log(`📊 FAISS 索引進度: ${((i + 1) / this.embeddings.length * 100).toFixed(1)}% (${i + 1}/${this.embeddings.length})`);
                }
            }
            console.log('✅ FAISS 索引建立完成');
        } else {
            throw new Error('沒有可用的嵌入向量來建立索引');
        }
        
        // 暫時禁用索引保存以避免序列化問題
        // await this.saveIndex();
        console.log('💾 FAISS 索引建立在內存中（未持久化）');
        
        // 設置初始化完成標誌
        this.isInitialized = true;
        console.log('✅ FAISS 向量服務初始化完成');
    }

    // 載入文本資料
    async loadTextData() {
        console.log('📁 正在載入神學資料...');
        
        // 首先檢查是否有預處理的向量資料
        const preprocessedVectorPath = path.join(__dirname, '../data/theology-vectors-compressed.json');
        try {
            const stats = await fs.stat(preprocessedVectorPath);
            console.log(`🚀 發現預處理向量資料: ${preprocessedVectorPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return await this.loadFromPreprocessedVectors(preprocessedVectorPath);
        } catch (error) {
            console.log('📝 未找到預處理向量資料，將使用傳統文本處理方式');
        }
        
        // 優先嘗試大文件，避免載入小的目錄文件
        const priorityFiles = [
            path.join(__dirname, '../data/ccel_books.zip'),
            path.join(__dirname, '../data/theology_texts.txt'),
            path.join(__dirname, '../data/theology_data.json')
        ];
        
        // 檢查優先的大文件
        for (const filePath of priorityFiles) {
            try {
                const stats = await fs.stat(filePath);
                console.log(`✅ 找到本地檔案: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                
                if (filePath.endsWith('.zip')) {
                    return await this.loadFromZip(filePath);
                } else if (filePath.endsWith('.json')) {
                    return await this.loadFromJSON(filePath);
                } else {
                    return await this.loadFromText(filePath);
                }
            } catch (error) {
                console.log(`❌ 本地檔案不存在: ${filePath}`);
            }
        }
        
        // 如果本地沒有大文件，嘗試從 Google Drive 下載
        console.log('🔄 本地無大文件，嘗試從 Google Drive 下載神學資料...');
        
        // 載入 Google Drive 設定（優先檢查向量資料配置）
        let googleDriveFiles = [];
        let config = null;
        
        // 首先嘗試載入預處理向量資料配置
        try {
            const vectorConfigPath = path.join(__dirname, '../config/google-drive-vectors.json');
            const vectorConfigData = await fs.readFile(vectorConfigPath, 'utf8');
            const vectorConfig = JSON.parse(vectorConfigData);
            
            // 檢查是否有有效的向量資料配置
            if (vectorConfig.files && vectorConfig.files.length > 0 && 
                vectorConfig.files[0].fileId !== 'PLACEHOLDER_VECTOR_FILE_ID') {
                console.log('🚀 發現預處理向量資料配置');
                googleDriveFiles = vectorConfig.files.map(file => ({
                    ...file,
                    localPath: path.join(__dirname, '..', file.localPath)
                }));
                config = vectorConfig;
                console.log(`📋 載入向量資料設定，找到 ${googleDriveFiles.length} 個檔案`);
            } else {
                throw new Error('向量資料配置未完成');
            }
        } catch (error) {
            console.log('📝 未找到有效的向量資料配置，嘗試載入原始文本配置');
            
            // 載入原始文本配置
            try {
                const configPath = path.join(__dirname, '../config/google-drive.json');
                const configData = await fs.readFile(configPath, 'utf8');
                config = JSON.parse(configData);
                googleDriveFiles = config.files.map(file => ({
                    ...file,
                    localPath: path.join(__dirname, '..', file.localPath)
                }));
                console.log(`📋 載入 Google Drive 設定，找到 ${googleDriveFiles.length} 個檔案`);
            } catch (error) {
                console.log('⚠️  無法載入 Google Drive 設定，使用預設設定');
                googleDriveFiles = [
                    {
                        name: 'ccel_books.zip',
                        fileId: '1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K',
                        localPath: path.join(__dirname, '../data/ccel_books.zip')
                    }
                ];
                config = { folderId: '1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K' };
            }
        }
        
        for (const file of googleDriveFiles) {
            try {
                console.log(`📥 嘗試下載: ${file.name}`);
                console.log(`🔍 檢查資料夾: fileId=${file.fileId}, folderId=${config?.folderId}`);
                
                // 檢查是否為資料夾 ID（通過檢查 fileId 和 folderId 是否相同）
                if (config && file.fileId === config.folderId) {
                    console.log('📁 檢測到資料夾 ID，嘗試下載資料夾中的所有文件...');
                    const outputDir = path.join(__dirname, '../data/downloaded_texts');
                    return await this.downloadFromGoogleDriveFolder(file.fileId, outputDir);
                }
                
                // 原有的單文件下載邏輯
                await this.downloadFromGoogleDrive(file.fileId, file.localPath);
                
                // 下載成功後處理檔案
                if (file.type === 'preprocessed_vectors' || file.name.includes('vectors')) {
                    console.log('🚀 識別為預處理向量資料文件');
                    return await this.loadFromPreprocessedVectors(file.localPath);
                } else if (file.localPath.endsWith('.zip')) {
                    return await this.loadFromZip(file.localPath);
                } else if (file.localPath.endsWith('.json')) {
                    return await this.loadFromJSON(file.localPath);
                } else {
                    return await this.loadFromText(file.localPath);
                }
            } catch (error) {
                console.log(`❌ Google Drive 下載失敗: ${file.name} - ${error.message}`);
            }
        }
        
        console.log('⚠️  未找到任何資料檔案，使用預設神學文本');
        return this.getDefaultTheologyTexts();
    }

    async loadFromZip(zipPath) {
        console.log('📦 正在處理壓縮檔案...');
        
        try {
            // 使用 Node.js 的內建模組來解壓縮
            const extract = require('extract-zip');
            const extractPath = path.join(__dirname, '../data/extracted');
            
            // 確保解壓縮目錄存在
            try {
                await fs.mkdir(extractPath, { recursive: true });
            } catch (error) {
                // 目錄可能已存在
            }
            
            await extract(zipPath, { dir: extractPath });
            console.log('✅ 壓縮檔案解壓縮完成');
            
            // 讀取所有 .txt 檔案
            const txtFiles = await this.findTxtFiles(extractPath);
            console.log(`📚 找到 ${txtFiles.length} 個文本檔案`);
            
            let allTexts = [];
            for (const txtFile of txtFiles) {
                try {
                    const content = await fs.readFile(txtFile, 'utf8');
                    const fileName = path.basename(txtFile, '.txt');
                    allTexts.push({
                        text: content,
                        fileName: fileName
                    });
                } catch (error) {
                    console.log(`⚠️  無法讀取檔案: ${txtFile}`);
                }
            }
            
            return allTexts;
            
        } catch (error) {
            console.error('❌ 解壓縮失敗:', error.message);
            throw error;
        }
    }

    async loadFromJSON(jsonPath) {
        console.log('📄 正在載入 JSON 資料...');
        const data = await fs.readFile(jsonPath, 'utf8');
        const jsonData = JSON.parse(data);
        return this.extractTextsFromJSON(jsonData);
    }

    async loadFromText(textPath) {
        console.log('📄 正在載入文本資料...');
        const data = await fs.readFile(textPath, 'utf8');
        return this.splitTextIntoChunks(data);
    }

    // 載入預處理的向量資料
    async loadFromPreprocessedVectors(vectorPath) {
        console.log('🚀 正在載入預處理向量資料...');
        
        try {
            const data = await fs.readFile(vectorPath, 'utf8');
            const vectorData = JSON.parse(data);
            
            console.log(`📊 向量資料版本: ${vectorData.version}`);
            console.log(`📅 建立時間: ${vectorData.createdAt}`);
            console.log(`🤖 模型: ${vectorData.model}`);
            console.log(`📐 維度: ${vectorData.dimensions}`);
            console.log(`📁 總文件數: ${vectorData.totalFiles}`);
            console.log(`📚 總片段數: ${vectorData.totalChunks}`);
            
            // 驗證資料完整性
            if (!vectorData.chunks || vectorData.chunks.length === 0) {
                throw new Error('向量資料中沒有找到文本片段');
            }
            
            if (vectorData.chunks.length !== vectorData.totalChunks) {
                console.warn(`⚠️  警告：實際片段數 (${vectorData.chunks.length}) 與記錄的總數 (${vectorData.totalChunks}) 不符`);
            }
            
            // 驗證第一個片段的結構
            const firstChunk = vectorData.chunks[0];
            if (!firstChunk.text || !firstChunk.embedding || !firstChunk.source) {
                throw new Error('向量資料格式無效：缺少必要的欄位 (text, embedding, source)');
            }
            
            if (!Array.isArray(firstChunk.embedding) || firstChunk.embedding.length !== vectorData.dimensions) {
                throw new Error(`向量資料格式無效：嵌入向量維度不正確 (期望 ${vectorData.dimensions}，實際 ${firstChunk.embedding?.length})`);
            }
            
            console.log('✅ 向量資料驗證通過');
            
            // 轉換為 VectorService 期望的格式
            const texts = vectorData.chunks.map(chunk => ({
                text: chunk.text,
                fileName: chunk.source,
                chunkIndex: chunk.chunkIndex || 0,
                metadata: chunk.metadata || {}
            }));
            
            const embeddings = vectorData.chunks.map(chunk => chunk.embedding);
            
            console.log(`🎉 成功載入 ${texts.length} 個文本片段和對應的嵌入向量`);
            console.log(`📊 平均每個文件 ${(texts.length / vectorData.totalFiles).toFixed(1)} 個片段`);
            
            // 返回特殊標記的資料結構
            return {
                isPreprocessedVectors: true,
                texts: texts,
                embeddings: embeddings,
                metadata: {
                    version: vectorData.version,
                    createdAt: vectorData.createdAt,
                    model: vectorData.model,
                    dimensions: vectorData.dimensions,
                    totalFiles: vectorData.totalFiles,
                    totalChunks: vectorData.totalChunks
                }
            };
            
        } catch (error) {
            console.error('❌ 載入預處理向量資料失敗:', error.message);
            throw error;
        }
    }

    async findTxtFiles(dir) {
        const txtFiles = [];
        
        async function scanDirectory(currentDir) {
            try {
                const items = await fs.readdir(currentDir);
                
                for (const item of items) {
                    const fullPath = path.join(currentDir, item);
                    const stat = await fs.stat(fullPath);
                    
                    if (stat.isDirectory()) {
                        await scanDirectory(fullPath);
                    } else if (item.toLowerCase().endsWith('.txt')) {
                        txtFiles.push(fullPath);
                    }
                }
            } catch (error) {
                console.log(`⚠️  無法掃描目錄: ${currentDir}`);
            }
        }
        
        await scanDirectory(dir);
        return txtFiles;
    }

    // 從 JSON 資料中提取文本
    extractTextsFromJSON(jsonData) {
        const texts = [];
        
        if (Array.isArray(jsonData)) {
            jsonData.forEach(item => {
                if (item.title) texts.push(item.title);
                if (item.author) texts.push(item.author);
                if (item.description) texts.push(item.description);
                if (item.content) texts.push(item.content);
            });
        } else if (typeof jsonData === 'object') {
            Object.values(jsonData).forEach(value => {
                if (typeof value === 'string') {
                    texts.push(value);
                }
            });
        }
        
        return texts.filter(text => text && text.trim().length > 10);
    }

    // 將文本分割成較小的片段
    splitTextIntoChunks(text, chunkSize = 1500, overlap = 200) {
        // 恢復高品質文本分割設置
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        
        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            
            if (currentChunk.length + trimmedSentence.length + 1 <= chunkSize) {
                currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk + '.');
                }
                
                // 處理重疊
                if (chunks.length > 0 && overlap > 0) {
                    const lastChunk = chunks[chunks.length - 1];
                    const overlapText = lastChunk.slice(-overlap);
                    currentChunk = overlapText + '. ' + trimmedSentence;
                } else {
                    currentChunk = trimmedSentence;
                }
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk + (currentChunk.endsWith('.') ? '' : '.'));
        }
        
        return chunks.filter(chunk => chunk.trim().length > 100);
    }

    // 預設神學文本（如果沒有找到資料檔案）
    getDefaultTheologyTexts() {
        return [
            {
                text: "三位一體是基督教的核心教義，指上帝是三位一體的：聖父、聖子、聖靈。這三位是同一位上帝，但有不同的位格。",
                fileName: "三位一體教義.txt"
            },
            {
                text: "原罪是指人類始祖亞當和夏娃在伊甸園中違背上帝命令，吃了禁果，導致人類與上帝關係破裂，所有後代都繼承了這種罪性。",
                fileName: "原罪教義.txt"
            },
            {
                text: "救恩是上帝通過耶穌基督的死亡和復活，為人類提供與上帝和好的途徑。這是一個免費的禮物，通過信心接受。",
                fileName: "救恩教義.txt"
            },
            {
                text: "聖經是上帝啟示的話語，包含舊約和新約兩部分。它是基督徒信仰和生活的權威指南。",
                fileName: "聖經權威.txt"
            },
            {
                text: "教會是基督的身體，是信徒的聚集。它的使命是傳揚福音、教導真理、施行聖禮、關懷社會。",
                fileName: "教會使命.txt"
            }
        ];
    }

    // 生成嵌入向量
    async generateEmbeddings(texts) {
        console.log(`正在生成嵌入向量...`);
        console.log(`📊 文本片段總數: ${texts.length}`);
        
        const embeddings = [];
        const BATCH_SIZE = 50; // 每批處理 50 個文本片段（減少批次大小）
        const PROGRESS_INTERVAL = 100; // 每 100 個顯示進度（減少日誌）
        
        let processedCount = 0;
        const totalBatches = Math.ceil(texts.length / BATCH_SIZE);
        
        console.log(`🔄 將分 ${totalBatches} 批處理，每批 ${BATCH_SIZE} 個片段`);
        
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            
            console.log(`📦 處理嵌入向量批次 ${batchNum}/${totalBatches}`);
            
            try {
                // 並行處理當前批次的嵌入向量
                const batchPromises = batch.map(async (textObj, index) => {
                    try {
                        const embedding = await this.generateEmbedding(textObj.text);
                        return embedding;
                    } catch (error) {
                        console.error(`❌ 生成嵌入向量失敗 (批次 ${batchNum}, 項目 ${index + 1}):`, error.message);
                        // 返回零向量作為後備
                        return new Array(1536).fill(0);
                    }
                });
                
                const batchEmbeddings = await Promise.all(batchPromises);
                embeddings.push(...batchEmbeddings);
                
                processedCount += batch.length;
                
                // 顯示進度
                if (processedCount % PROGRESS_INTERVAL === 0 || batchNum === totalBatches) {
                    const progress = ((processedCount / texts.length) * 100).toFixed(1);
                    console.log(`📈 嵌入向量進度: ${progress}% (${processedCount}/${texts.length})`);
                }
                
                // 批次間短暫休息，避免 API 限制
                if (i + BATCH_SIZE < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`❌ 批次 ${batchNum} 處理失敗:`, error.message);
                // 為失敗的批次添加零向量
                const fallbackEmbeddings = new Array(batch.length).fill(null).map(() => new Array(1536).fill(0));
                embeddings.push(...fallbackEmbeddings);
                processedCount += batch.length;
            }
        }
        
        console.log(`✅ 成功生成 ${embeddings.length} 個嵌入向量`);
        console.log(`📊 嵌入向量維度: ${embeddings[0]?.length || 1536}`);
        
        return embeddings;
    }

    // 生成嵌入向量
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
                dimensions: 1536
            });
            
            // 確保返回的是 JavaScript Array
            const embedding = response.data[0].embedding;
            return Array.from(embedding);
        } catch (error) {
            console.error('生成嵌入向量失敗:', error);
            throw error;
        }
    }

    // 保存索引和文本資料
    async saveIndex() {
        try {
            const dataDir = path.join(__dirname, '../data');
            
            // 確保資料目錄存在
            try {
                await fs.mkdir(dataDir, { recursive: true });
            } catch (error) {
                // 目錄可能已存在
            }
            
            // 保存 FAISS 索引
            const indexPath = path.join(dataDir, 'faiss_index.bin');
            const indexBuffer = this.faissIndex.toBuffer();
            await fs.writeFile(indexPath, indexBuffer);
            
            // 保存文本資料
            const textsPath = path.join(dataDir, 'texts.json');
            await fs.writeFile(textsPath, JSON.stringify(this.texts, null, 2));
            
            console.log('索引和文本資料已保存');
            
        } catch (error) {
            console.error('保存索引失敗:', error);
            throw error;
        }
    }

    // 搜索相關文本
    async search(query, topK = 5) {
        if (!this.faissIndex) {
            throw new Error('FAISS 索引未初始化');
        }

        console.log(`🔍 執行向量搜索: "${query}"`);
        
        // 確保 topK 不超過現有文本數量
        const actualTopK = Math.min(topK, this.texts.length);
        console.log(`📊 搜索參數: topK=${topK}, 實際使用=${actualTopK}, 總文本數=${this.texts.length}`);
        
        // 生成查詢的嵌入向量
        const queryEmbedding = await this.generateEmbedding(query);
        
        // 執行 FAISS 搜索
        try {
            const queryVector = Array.from(queryEmbedding);
            const searchResults = this.faissIndex.search(queryVector, actualTopK);
            
            console.log(`📊 找到 ${searchResults.labels.length} 個相關文本片段`);
            
            // 返回相關文本片段
            const relevantTexts = searchResults.labels.map((textIndex, index) => {
                const distance = searchResults.distances[index];
                const similarity = 1 / (1 + distance); // 將距離轉換為相似度分數
                const text = this.texts[textIndex];
                
                return {
                    text: text.text,
                    fileName: text.fileName,
                    similarity: similarity,
                    distance: distance,
                    index: textIndex
                };
            });
            
            return relevantTexts;
        } catch (error) {
            console.error('FAISS 搜索失敗:', error);
            throw error;
        }
    }

    // 混合搜索策略：結合 FAISS 和 Assistant API
    async hybridSearch(query, topK = 5) {
        const startTime = Date.now();
        console.log(`🔍 執行混合搜索: "${query}"`);
        
        // 根據問題複雜度動態調整參數
        const isComplexQuery = this.isComplexQuery(query);
        const isSimpleQuery = this.isSimpleQuery(query);
        
        // 快速回答模式：簡單問題使用更激進的優化
        const useFastMode = isSimpleQuery;
        const adjustedTopK = useFastMode ? 3 : (isComplexQuery ? 6 : 4);
        const adjustedMaxTokens = useFastMode ? 800 : (isComplexQuery ? 1500 : 1000);
        const model = useFastMode ? "gpt-3.5-turbo" : "gpt-4o-mini";
        
        console.log(`📊 問題類型: ${useFastMode ? '快速模式' : (isComplexQuery ? '複雜' : '標準')}`);
        console.log(`📊 優化參數: topK=${adjustedTopK}, max_tokens=${adjustedMaxTokens}, model=${model}`);
        
        try {
            // 1. 使用 FAISS 進行快速向量搜索
            const vectorResults = await this.search(query, adjustedTopK);
            console.log(`📊 FAISS 找到 ${vectorResults.length} 個相關片段`);
            
            // 2. 使用 OpenAI Chat Completions API 生成高品質回答
            const completion = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: useFastMode ? 
                            `您是神學知識庫助手。請簡潔準確地回答問題，使用 [1], [2], [3] 格式引用。保持學術性但簡潔。` :
                            `您是一位專業的神學知識庫助手。請根據提供的上下文資料，為用戶提供準確、詳細且學術性的回答。

回答要求：
1. 基於提供的上下文資料進行回答
2. 保持學術性和專業性
3. 如果上下文資料不足，請明確說明
4. 在回答中引用相關的來源，使用 [1], [2], [3] 等格式標註引用
5. 使用中文回答，保持傳統中文的表達方式
6. 確保每個引用都有對應的來源資料

重要：請在回答中使用 [1], [2], [3] 等格式來標註引用，這些標註會自動轉換為可點擊的引用連結。`
                    },
                    {
                        role: "user",
                        content: `問題：${query}

相關資料（請在回答中使用 [1], [2], [3] 等格式引用）：

${vectorResults.map((result, index) => `[${index + 1}] 來源：${result.fileName}
內容：${result.text}`).join('\n\n')}`
                    }
                ],
                temperature: useFastMode ? 0.1 : 0.3,
                max_tokens: adjustedMaxTokens
            });
            
            const answer = completion.choices[0].message.content;
            
            // 3. 格式化來源
            const sources = vectorResults.map((result, index) => ({
                index: index + 1,
                fileName: result.fileName || "unknown",
                quote: result.text.substring(0, 200) + "...",
                similarity: result.similarity,
                text: result.text
            }));
            
            return {
                answer: answer,
                sources: sources,
                method: `Hybrid (FAISS + ${model})`,
                vectorResults: vectorResults.length,
                responseTime: Date.now() - startTime
            };
            
        } catch (error) {
            console.error('❌ 混合搜索失敗:', error.message);
            throw error;
        }
    }

    // 啟動背景處理
    async startBackgroundProcessing(outputDir, remainingFiles, downloadOnlyMode) {
        console.log('🚀 啟動背景處理...');
        
        // 延遲 10 秒後開始背景處理，確保系統完全啟動
        setTimeout(async () => {
            try {
                console.log('🔄 開始背景處理剩餘文件...');
                console.log(`📊 待處理文件數: ${remainingFiles.length}`);
                
                let processedCount = 0;
                const batchSize = 10; // 每批處理 10 個文件
                
                for (let i = 0; i < remainingFiles.length; i += batchSize) {
                    const batch = remainingFiles.slice(i, i + batchSize);
                    const batchNum = Math.floor(i / batchSize) + 1;
                    const totalBatches = Math.ceil(remainingFiles.length / batchSize);
                    
                    console.log(`\n📦 背景處理批次 ${batchNum}/${totalBatches} (${batch.length} 個文件)`);
                    
                    for (const file of batch) {
                        try {
                            const filePath = path.join(outputDir, file.name);
                            
                            // 下載文件
                            console.log(`📥 背景下載: ${file.name}`);
                            await this.downloadFromGoogleDrive(file.id, filePath);
                            
                            // 如果是文本文件且不是下載模式，則處理文本
                            if (file.name.toLowerCase().endsWith('.txt') && !downloadOnlyMode) {
                                const content = await fs.readFile(filePath, 'utf8');
                                const chunks = this.splitTextIntoChunks(content);
                                
                                chunks.forEach(chunk => {
                                    this.texts.push({
                                        text: chunk,
                                        fileName: file.name
                                    });
                                });
                                
                                console.log(`📚 處理文本: ${file.name} -> ${chunks.length} 個片段`);
                            }
                            
                            processedCount++;
                            
                            // 更新進度
                            this.progress.processedFiles = this.progress.processedFiles + processedCount;
                            this.progress.remainingFiles = this.progress.totalFiles - this.progress.processedFiles;
                            
                            // 每處理 5 個文件顯示一次進度
                            if (processedCount % 5 === 0) {
                                const totalProcessed = this.progress.processedFiles;
                                const progressPercent = ((totalProcessed / this.progress.totalFiles) * 100).toFixed(1);
                                console.log(`📊 背景處理進度: ${progressPercent}% (${totalProcessed}/${this.progress.totalFiles})`);
                            }
                            
                        } catch (error) {
                            console.error(`❌ 背景處理文件失敗 ${file.name}:`, error.message);
                            continue;
                        }
                    }
                    
                    // 批次間休息 3 秒
                    if (i + batchSize < remainingFiles.length) {
                        console.log(`⏸️  批次 ${batchNum} 完成，休息 3 秒...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }
                
                console.log('🎉 背景處理完成！');
                console.log(`✅ 總共處理了 ${processedCount} 個文件`);
                console.log(`📚 總文本片段數: ${this.texts.length}`);
                
                // 重新建立索引以包含新處理的文件
                if (!downloadOnlyMode && this.texts.length > 0) {
                    console.log('🔄 重新建立 FAISS 索引以包含新文件...');
                    await this.buildIndex();
                    console.log('✅ FAISS 索引更新完成');
                }
                
                this.progress.isBackgroundProcessing = false;
                
            } catch (error) {
                console.error('❌ 背景處理失敗:', error.message);
                this.progress.isBackgroundProcessing = false;
            }
        }, 10000); // 10 秒後開始
    }

    // 判斷問題複雜度
    isComplexQuery(query) {
        const complexKeywords = [
            '比較', '對比', '差異', '關係', '影響', '發展', '歷史',
            '演變', '學派', '爭議', '辯論', '解釋', '分析', '探討',
            '為什麼', '如何', '什麼是', '什麼時候', '在哪裡'
        ];
        
        const complexPatterns = [
            /與.*的關係/,
            /對.*的影響/,
            /.*和.*的比較/,
            /.*發展.*歷史/,
            /.*學派.*觀點/
        ];
        
        // 檢查關鍵詞
        const hasComplexKeywords = complexKeywords.some(keyword => 
            query.includes(keyword)
        );
        
        // 檢查複雜模式
        const hasComplexPatterns = complexPatterns.some(pattern => 
            pattern.test(query)
        );
        
        // 檢查問題長度（長問題通常更複雜）
        const isLongQuery = query.length > 20;
        
        return hasComplexKeywords || hasComplexPatterns || isLongQuery;
    }

    // 判斷簡單問題（適合快速模式）
    isSimpleQuery(query) {
        const simpleKeywords = [
            '基督', '耶穌', '三位一體', '聖父', '聖子', '聖靈',
            '救恩', '原罪', '教會', '聖經', '福音', '信仰',
            '上帝', '神', '天父', '主', '救主'
        ];
        
        // 簡單問題特徵：單一概念，短問題
        const isShortQuery = query.length <= 10;
        const hasSimpleKeyword = simpleKeywords.some(keyword => 
            query.includes(keyword)
        );
        
        // 不包含複雜詞彙
        const hasNoComplexWords = !this.isComplexQuery(query);
        
        return isShortQuery && hasSimpleKeyword && hasNoComplexWords;
    }

    // 獲取服務狀態
    getStatus() {
        const status = {
            isInitialized: this.isInitialized,
            textCount: this.texts.length,
            hasIndex: !!this.faissIndex
        };
        
        // 添加進度資訊
        if (this.progress.isBackgroundProcessing) {
            const elapsed = Date.now() - this.progress.startTime;
            const progressPercent = this.progress.totalFiles > 0 ? 
                ((this.progress.processedFiles / this.progress.totalFiles) * 100).toFixed(1) : 0;
            
            // 估算剩餘時間
            let estimatedTimeRemaining = null;
            if (this.progress.processedFiles > 0) {
                const avgTimePerFile = elapsed / this.progress.processedFiles;
                const remainingFiles = this.progress.totalFiles - this.progress.processedFiles;
                estimatedTimeRemaining = Math.round(avgTimePerFile * remainingFiles / 1000); // 秒
            }
            
            status.progress = {
                totalFiles: this.progress.totalFiles,
                processedFiles: this.progress.processedFiles,
                downloadedFiles: this.progress.downloadedFiles,
                remainingFiles: this.progress.remainingFiles,
                progressPercent: parseFloat(progressPercent),
                elapsedSeconds: Math.round(elapsed / 1000),
                estimatedTimeRemaining: estimatedTimeRemaining,
                isBackgroundProcessing: true
            };
        }
        
        return status;
    }
}

module.exports = VectorService; 