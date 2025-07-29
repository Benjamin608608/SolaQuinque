const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

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

    // 初始化 FAISS 索引
    async initialize() {
        try {
            console.log('正在初始化向量服務...');
            
            // 檢查是否有預先建立的向量索引
            const indexPath = path.join(__dirname, '../data/faiss_index.bin');
            const textsPath = path.join(__dirname, '../data/texts.json');
            
            try {
                // 嘗試載入現有的索引
                const indexData = await fs.readFile(indexPath);
                const textsData = await fs.readFile(textsPath, 'utf8');
                
                this.faissIndex = new (require('faiss-node').Index)(indexData);
                this.texts = JSON.parse(textsData);
                
                console.log(`成功載入現有索引，包含 ${this.texts.length} 個文本片段`);
                this.isInitialized = true;
                return;
            } catch (error) {
                console.log('未找到現有索引，開始建立新的向量索引...');
            }

            // 建立新的向量索引
            await this.buildIndex();
            
        } catch (error) {
            console.error('初始化向量服務失敗:', error);
            throw error;
        }
    }

    // 建立向量索引
    async buildIndex() {
        try {
            console.log('開始建立向量索引...');
            
            // 載入文本資料
            await this.loadTextData();
            
            // 為每個文本片段生成嵌入向量
            console.log('正在生成嵌入向量...');
            for (let i = 0; i < this.texts.length; i++) {
                const text = this.texts[i];
                const embedding = await this.generateEmbedding(text);
                this.embeddings.push(embedding);
                
                if ((i + 1) % 100 === 0) {
                    console.log(`已處理 ${i + 1}/${this.texts.length} 個文本片段`);
                }
            }
            
            // 建立 FAISS 索引
            console.log('正在建立 FAISS 索引...');
            const { Index } = require('faiss-node');
            this.faissIndex = new Index('Flat', 1536); // 使用 Flat 索引，1536 維度
            
            // 將嵌入向量添加到索引
            const embeddingsArray = new Float32Array(this.embeddings.flat());
            this.faissIndex.add(embeddingsArray);
            
            // 保存索引和文本資料
            await this.saveIndex();
            
            console.log('向量索引建立完成！');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('建立向量索引失敗:', error);
            throw error;
        }
    }

    // 載入文本資料
    async loadTextData() {
        try {
            // 嘗試從多個可能的來源載入資料
            const possiblePaths = [
                path.join(__dirname, '../data/theology_texts.txt'),
                path.join(__dirname, '../data/ccel_catalog.json'),
                path.join(__dirname, '../public/ccel_catalog.json')
            ];
            
            for (const filePath of possiblePaths) {
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    
                    if (filePath.endsWith('.json')) {
                        // 處理 JSON 格式
                        const jsonData = JSON.parse(data);
                        this.texts = this.extractTextsFromJSON(jsonData);
                    } else {
                        // 處理純文本格式
                        this.texts = this.splitTextIntoChunks(data);
                    }
                    
                    console.log(`成功載入 ${this.texts.length} 個文本片段`);
                    return;
                } catch (error) {
                    console.log(`無法載入 ${filePath}:`, error.message);
                }
            }
            
            // 如果沒有找到資料，使用預設的神學文本
            console.log('使用預設神學文本...');
            this.texts = this.getDefaultTheologyTexts();
            
        } catch (error) {
            console.error('載入文本資料失敗:', error);
            throw error;
        }
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

    // 向量搜索
    async search(query, topK = 5) {
        if (!this.isInitialized) {
            throw new Error('向量服務尚未初始化');
        }
        
        try {
            // 生成查詢的嵌入向量
            const queryEmbedding = await this.generateEmbedding(query);
            
            // 執行向量搜索
            const queryArray = new Float32Array(queryEmbedding);
            const { distances, indices } = this.faissIndex.search(queryArray, topK);
            
            // 返回相關文本
            const results = indices.map((index, i) => ({
                text: this.texts[index],
                score: 1 - distances[i], // 轉換距離為相似度分數
                index: index
            }));
            
            return results;
            
        } catch (error) {
            console.error('向量搜索失敗:', error);
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