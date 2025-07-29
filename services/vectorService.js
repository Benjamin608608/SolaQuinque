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
            // 使用 Google Drive 的直接下載連結
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
            }
            
            // 確保輸出目錄存在
            const outputDir = path.dirname(outputPath);
            try {
                await fs.mkdir(outputDir, { recursive: true });
            } catch (error) {
                // 目錄可能已存在
            }
            
            // 將檔案寫入本地
            const buffer = await response.buffer();
            await fs.writeFile(outputPath, buffer);
            
            console.log(`✅ 檔案下載完成: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
            return outputPath;
            
        } catch (error) {
            console.error('❌ Google Drive 下載失敗:', error.message);
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
            
            try {
                // 嘗試載入現有的索引
                const indexData = await fs.readFile(indexPath);
                const textsData = await fs.readFile(textsPath, 'utf8');
                
                this.faissIndex = new (require('faiss-node').Index)(indexData);
                this.texts = JSON.parse(textsData);
                
                console.log(`✅ 成功載入現有索引，包含 ${this.texts.length} 個文本片段`);
                this.isInitialized = true;
                return;
            } catch (error) {
                console.log('📝 未找到現有索引，開始建立新的向量索引...');
            }

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
            // 將嵌入向量展平成一個大的 Float32Array
            const dim = this.embeddings[0].length;
            const embeddingsArray = new Float32Array(this.embeddings.length * dim);
            for (let i = 0; i < this.embeddings.length; i++) {
                embeddingsArray.set(this.embeddings[i], i * dim);
            }
            // 批量加入所有向量
            this.faissIndex.add(embeddingsArray, this.embeddings.length);
            console.log('FAISS 索引建立完成');
        } else {
            throw new Error('沒有可用的嵌入向量來建立索引');
        }
        
        // 保存索引和文本
        await this.saveIndex();
    }

    // 載入文本資料
    async loadTextData() {
        console.log('📁 正在載入神學資料...');
        
        // 首先檢查本地檔案
        const possibleFiles = [
            path.join(__dirname, '../data/theology_texts.txt'),
            path.join(__dirname, '../data/theology_data.json'),
            path.join(__dirname, '../data/ccel_catalog.json'),
            path.join(__dirname, '../public/ccel_catalog.json'),
            path.join(__dirname, '../data/ccel_books.zip')
        ];
        
        for (const filePath of possibleFiles) {
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
        
        // 如果本地沒有檔案，嘗試從 Google Drive 下載
        console.log('🔄 嘗試從 Google Drive 下載資料...');
        
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
            
            return response.data[0].embedding;
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
        const { IndexFlatL2 } = require('faiss-node');
        const results = this.faissIndex.search(queryEmbedding, topK);
        
        console.log(`📊 找到 ${results.length} 個相關文本片段`);
        
        // 返回相關文本片段
        const relevantTexts = results.map((result, index) => {
            const textIndex = result.id;
            const similarity = result.score;
            const text = this.texts[textIndex];
            
            return {
                text: text.text,
                fileName: text.fileName,
                similarity: similarity,
                index: textIndex
            };
        });
        
        return relevantTexts;
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