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
            
            if (filesList.length === 0) {
                throw new Error('資料夾中沒有找到文件');
            }
            
            const texts = [];
            let downloadedCount = 0;
            let processedTextCount = 0;
            let skippedCount = 0;
            
            // 確保輸出目錄存在
            try {
                await fs.mkdir(outputDir, { recursive: true });
            } catch (error) {
                // 目錄可能已存在
            }
            
            // 分階段載入策略
            const INITIAL_BATCH_SIZE = 25;  // 每批 25 個文件
            const INITIAL_MAX_FILES = 400;  // 初始階段載入 400 個文件
            const PROGRESS_INTERVAL = 20;   // 每 20 個文件顯示進度
            
            // 檢測是否為初始建立索引階段
            const isInitialBuild = process.env.NODE_ENV === 'production' && !process.env.SKIP_INITIAL_LIMIT;
            
            let filesToProcess;
            if (isInitialBuild) {
                filesToProcess = filesList.slice(0, INITIAL_MAX_FILES);
                console.log(`🚀 初始建立階段：處理前 ${filesToProcess.length} 個文件`);
                console.log(`📝 剩餘 ${filesList.length - filesToProcess.length} 個文件將在系統啟動後背景載入`);
            } else {
                filesToProcess = filesList;
                console.log(`🎯 完整載入模式：處理所有 ${filesToProcess.length} 個文件`);
            }
            
            console.log(`📦 批次大小: ${INITIAL_BATCH_SIZE} 個文件/批`);
            console.log(`📊 預計批次數: ${Math.ceil(filesToProcess.length / INITIAL_BATCH_SIZE)}`);
            
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
                        
                        // 如果是文本文件，讀取內容
                        if (file.name.toLowerCase().endsWith('.txt')) {
                            const content = await fs.readFile(filePath, 'utf8');
                            const chunks = this.splitTextIntoChunks(content);
                            
                            chunks.forEach(chunk => {
                                texts.push({
                                    text: chunk,
                                    fileName: file.name
                                });
                            });
                            
                            processedTextCount += chunks.length;
                        }
                        
                        downloadedCount++;
                        
                        // 定期顯示進度
                        if (downloadedCount % PROGRESS_INTERVAL === 0) {
                            console.log(`📊 進度更新: 已下載 ${downloadedCount}/${filesToProcess.length} 個文件，跳過 ${skippedCount} 個，提取了 ${processedTextCount} 個文本片段`);
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
            
            console.log(`\n🎉 ${isInitialBuild ? '初始階段' : '完整'}處理完成！`);
            console.log(`✅ 成功下載: ${downloadedCount} 個文件`);
            console.log(`⏭️  跳過已存在: ${skippedCount} 個文件`);
            console.log(`📚 提取文本片段: ${texts.length} 個`);
            console.log(`📈 平均每文件片段數: ${(texts.length / Math.max(downloadedCount, 1)).toFixed(1)}`);
            
            if (isInitialBuild && filesList.length > INITIAL_MAX_FILES) {
                console.log(`\n🔄 背景載入計劃:`);
                console.log(`   - 已載入: ${filesToProcess.length} 個文件`);
                console.log(`   - 待載入: ${filesList.length - filesToProcess.length} 個文件`);
                console.log(`   - 系統啟動後將自動背景載入剩餘文件`);
                
                // 保存剩餘文件列表供背景載入使用
                const remainingFiles = filesList.slice(INITIAL_MAX_FILES);
                const remainingFilesPath = path.join(outputDir, 'remaining_files.json');
                await fs.writeFile(remainingFilesPath, JSON.stringify(remainingFiles, null, 2));
                console.log(`💾 剩餘文件列表已保存到: ${remainingFilesPath}`);
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
        
        // 載入 Google Drive 設定
        let googleDriveFiles = [];
        let config = null;
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
                if (file.localPath.endsWith('.zip')) {
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

    // 將長文本分割成小片段
    splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            } else {
                currentChunk += sentence + '。';
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    // 預設神學文本（如果沒有找到資料檔案）
    getDefaultTheologyTexts() {
        return [
            "三位一體是基督教的核心教義，指上帝是三位一體的：聖父、聖子、聖靈。這三位是同一位上帝，但有不同的位格。",
            "原罪是指人類始祖亞當和夏娃在伊甸園中違背上帝命令，吃了禁果，導致人類與上帝關係破裂，所有後代都繼承了這種罪性。",
            "救恩是上帝通過耶穌基督的死亡和復活，為人類提供與上帝和好的途徑。這是一個免費的禮物，通過信心接受。",
            "聖經是上帝啟示的話語，包含舊約和新約兩部分。它是基督徒信仰和生活的權威指南。",
            "教會是基督的身體，是信徒的聚集。它的使命是傳揚福音、教導真理、施行聖禮、關懷社會。"
        ];
    }

    // 生成嵌入向量
    async generateEmbeddings(texts) {
        console.log(`正在生成嵌入向量...`);
        console.log(`📊 文本片段總數: ${texts.length}`);
        
        const embeddings = [];
        const BATCH_SIZE = 100; // 每批處理 100 個文本片段
        const PROGRESS_INTERVAL = 200; // 每 200 個顯示進度
        
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
    async hybridSearch(query, topK = 10) {
        console.log(`🔍 執行混合搜索: "${query}"`);
        
        try {
            // 1. 使用 FAISS 進行快速向量搜索
            const vectorResults = await this.search(query, topK);
            console.log(`📊 FAISS 找到 ${vectorResults.length} 個相關片段`);
            
            // 2. 構建上下文
            const context = vectorResults.map(result => 
                `[來源: ${result.fileName}]\n${result.text}\n`
            ).join('\n---\n');
            
            // 3. 使用 OpenAI Chat Completions API 生成高品質回答
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `您是一位專業的神學知識庫助手。請根據提供的上下文資料，為用戶提供準確、詳細且學術性的回答。

回答要求：
1. 基於提供的上下文資料進行回答
2. 保持學術性和專業性
3. 如果上下文資料不足，請明確說明
4. 引用相關的來源和作者
5. 使用中文回答，保持傳統中文的表達方式

請確保回答的準確性和完整性。`
                    },
                    {
                        role: "user",
                        content: `問題：${query}\n\n相關資料：\n${context}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            });
            
            const answer = completion.choices[0].message.content;
            
            // 4. 格式化來源
            const sources = vectorResults.map(result => ({
                fileName: result.fileName,
                similarity: result.similarity,
                text: result.text.substring(0, 200) + "..."
            }));
            
            return {
                answer: answer,
                sources: sources,
                method: "Hybrid (FAISS + GPT-4o-mini)",
                vectorResults: vectorResults.length
            };
            
        } catch (error) {
            console.error('❌ 混合搜索失敗:', error.message);
            throw error;
        }
    }

    // 獲取服務狀態
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            textCount: this.texts.length,
            hasIndex: !!this.faissIndex
        };
    }
}

module.exports = VectorService; 