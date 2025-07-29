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
            // 首先檢查文件是否存在和可以下載
            const checkUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size,mimeType`;
            const checkResponse = await fetch(checkUrl);
            
            if (!checkResponse.ok) {
                throw new Error(`文件檢查失敗: ${checkResponse.status} ${checkResponse.statusText}`);
            }
            
            const fileMetadata = await checkResponse.json();
            console.log(`📄 檔案資訊: ${fileMetadata.name} (${(fileMetadata.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // 使用 Google Drive API 的正確下載 URL
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                // 如果是 403 錯誤，嘗試使用公開分享連結
                if (response.status === 403) {
                    console.log('📁 嘗試使用公開分享連結下載...');
                    const publicUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
                    const publicResponse = await fetch(publicUrl);
                    
                    if (!publicResponse.ok) {
                        throw new Error(`公開下載失敗: ${publicResponse.status} ${publicResponse.statusText}`);
                    }
                    
                    return this.processDownloadResponse(publicResponse, outputPath);
                } else {
                    throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
                }
            }
            
            return this.processDownloadResponse(response, outputPath);
            
        } catch (error) {
            console.error('❌ Google Drive 下載失敗:', error.message);
            throw error;
        }
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
        
        // 使用 streams 處理大文件
        const fileStream = require('fs').createWriteStream(outputPath);
        let downloadedSize = 0;
        
        // 監聽下載進度
        const reader = response.body.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                fileStream.write(value);
                downloadedSize += value.length;
                
                if (totalSize > 0) {
                    const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                    if (downloadedSize % (1024 * 1024 * 5) === 0) { // 每 5MB 顯示一次進度
                        console.log(`📊 下載進度: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
                    }
                }
            }
            
            fileStream.end();
            
            // 等待文件寫入完成
            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });
            
            console.log(`✅ 檔案下載完成: ${outputPath} (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
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
        
        // 為每個文本片段生成嵌入向量
        for (let i = 0; i < this.texts.length; i++) {
            try {
                const embedding = await this.generateEmbedding(this.texts[i].text);
                this.embeddings.push(embedding);
                
                if ((i + 1) % 50 === 0) {
                    console.log(`已處理 ${i + 1}/${this.texts.length} 個文本片段`);
                }
            } catch (error) {
                console.error(`生成第 ${i + 1} 個嵌入向量時發生錯誤:`, error.message);
                // 跳過這個文本片段
                this.texts.splice(i, 1);
                i--;
            }
        }
        
        console.log(`成功生成 ${this.embeddings.length} 個嵌入向量`);
        
        // 建立 FAISS 索引
        const { IndexFlatL2 } = require('faiss-node');
        this.faissIndex = new IndexFlatL2(this.embeddings[0].length);
        
        if (this.embeddings.length > 0) {
            // 將所有向量添加到 FAISS 索引
            for (let i = 0; i < this.embeddings.length; i++) {
                const vector = Array.from(this.embeddings[i]);
                this.faissIndex.add(vector);
            }
            console.log('FAISS 索引建立完成');
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
        console.log('🔄 本地無大文件，嘗試從 Google Drive 下載 ccel_books.zip...');
        
        // 載入 Google Drive 設定
        let googleDriveFiles = [];
        try {
            const configPath = path.join(__dirname, '../config/google-drive.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
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
        }
        
        for (const file of googleDriveFiles) {
            try {
                console.log(`📥 嘗試下載: ${file.name}`);
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
        
        // 生成查詢的嵌入向量
        const queryEmbedding = await this.generateEmbedding(query);
        
        // 執行 FAISS 搜索
        try {
            const queryVector = Array.from(queryEmbedding);
            const searchResults = this.faissIndex.search(queryVector, topK);
            
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