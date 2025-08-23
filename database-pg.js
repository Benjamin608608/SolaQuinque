const { Pool } = require('pg');

// PostgreSQL 連接池
class PostgreSQLNotesDB {
    constructor() {
        // Railway 會自動提供 DATABASE_URL 環境變數
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // 不在構造函數中調用 initDatabase，避免未處理的 Promise
        // this.initDatabase();
    }
    
    // 初始化資料庫表格
    async initDatabase() {
        const client = await this.pool.connect();
        try {
            // 建立筆記資料表
            await client.query(`
                CREATE TABLE IF NOT EXISTS notes (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    bible_book TEXT,
                    bible_book_zh TEXT,
                    bible_chapter INTEGER,
                    bible_verse_start INTEGER,
                    bible_verse_end INTEGER,
                    bible_version TEXT DEFAULT 'CUV',
                    bible_text TEXT,
                    tags JSONB DEFAULT '[]'::jsonb,
                    category TEXT DEFAULT 'default',
                    color TEXT DEFAULT 'blue',
                    is_public BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            // 建立索引
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
                CREATE INDEX IF NOT EXISTS idx_notes_bible_ref ON notes(bible_book, bible_chapter);
                CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
                CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);
            `);
            
            console.log('✅ PostgreSQL 筆記資料表已建立');
            console.log('✅ PostgreSQL 資料庫索引已建立');
            console.log('✅ PostgreSQL 筆記資料庫初始化完成');
        } catch (error) {
            console.error('❌ PostgreSQL 初始化失敗:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    // 建立新筆記
    async createNote(noteData) {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO notes (
                    user_id, title, content, bible_book, bible_book_zh, 
                    bible_chapter, bible_verse_start, bible_verse_end, 
                    bible_version, bible_text, tags, category, color, is_public
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id
            `;
            
            const values = [
                noteData.userId,
                noteData.title,
                noteData.content,
                noteData.bibleBook || null,
                noteData.bibleBookZh || null,
                noteData.bibleChapter || null,
                noteData.bibleVerseStart || null,
                noteData.bibleVerseEnd || null,
                noteData.bibleVersion || 'CUV',
                noteData.bibleText || null,
                JSON.stringify(noteData.tags || []),
                noteData.category || 'default',
                noteData.color || 'blue',
                noteData.isPublic || false
            ];
            
            const result = await client.query(query, values);
            return { id: result.rows[0].id, success: true };
        } catch (error) {
            console.error('建立筆記失敗:', error);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }
    
    // 獲取用戶筆記
    async getUserNotes(userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM notes 
                WHERE user_id = $1 
                ORDER BY created_at DESC
            `;
            
            const result = await client.query(query, [userId]);
            return result.rows.map(this.formatNote);
        } catch (error) {
            console.error('獲取筆記失敗:', error);
            return [];
        } finally {
            client.release();
        }
    }
    
    // 獲取特定筆記
    async getNoteById(id, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM notes 
                WHERE id = $1 AND user_id = $2
            `;
            
            const result = await client.query(query, [id, userId]);
            return result.rows.length > 0 ? this.formatNote(result.rows[0]) : null;
        } catch (error) {
            console.error('獲取筆記失敗:', error);
            return null;
        } finally {
            client.release();
        }
    }
    
    // 更新筆記
    async updateNote(id, userId, updateData) {
        const client = await this.pool.connect();
        try {
            const query = `
                UPDATE notes 
                SET title = $1, content = $2, tags = $3, category = $4, 
                    color = $5, is_public = $6, updated_at = CURRENT_TIMESTAMP
                WHERE id = $7 AND user_id = $8
            `;
            
            const values = [
                updateData.title,
                updateData.content,
                JSON.stringify(updateData.tags || []),
                updateData.category || 'default',
                updateData.color || 'blue',
                updateData.isPublic || false,
                id,
                userId
            ];
            
            const result = await client.query(query, values);
            return { success: result.rowCount > 0 };
        } catch (error) {
            console.error('更新筆記失敗:', error);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }
    
    // 刪除筆記
    async deleteNote(id, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                DELETE FROM notes 
                WHERE id = $1 AND user_id = $2
            `;
            
            const result = await client.query(query, [id, userId]);
            return { success: result.rowCount > 0 };
        } catch (error) {
            console.error('刪除筆記失敗:', error);
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }
    
    // 搜尋筆記
    async searchNotes(userId, searchTerm) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM notes 
                WHERE user_id = $1 AND (
                    title ILIKE $2 OR 
                    content ILIKE $2 OR 
                    bible_text ILIKE $2
                )
                ORDER BY created_at DESC
            `;
            
            const searchPattern = `%${searchTerm}%`;
            const result = await client.query(query, [userId, searchPattern]);
            return result.rows.map(this.formatNote);
        } catch (error) {
            console.error('搜尋筆記失敗:', error);
            return [];
        } finally {
            client.release();
        }
    }
    
    // 按分類獲取筆記
    async getNotesByCategory(userId, category) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM notes 
                WHERE user_id = $1 AND category = $2
                ORDER BY created_at DESC
            `;
            
            const result = await client.query(query, [userId, category]);
            return result.rows.map(this.formatNote);
        } catch (error) {
            console.error('獲取分類筆記失敗:', error);
            return [];
        } finally {
            client.release();
        }
    }
    
    // 按聖經章節獲取筆記
    async getNotesByBibleRef(userId, book, chapter) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM notes 
                WHERE user_id = $1 AND bible_book = $2 AND bible_chapter = $3
                ORDER BY created_at DESC
            `;
            
            const result = await client.query(query, [userId, book, chapter]);
            return result.rows.map(this.formatNote);
        } catch (error) {
            console.error('獲取聖經筆記失敗:', error);
            return [];
        } finally {
            client.release();
        }
    }
    
    // 獲取用戶統計
    async getUserStats(userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_notes,
                    COUNT(DISTINCT category) as categories_count,
                    COUNT(DISTINCT bible_book) as books_count
                FROM notes 
                WHERE user_id = $1
            `;
            
            const result = await client.query(query, [userId]);
            return result.rows[0] || { total_notes: 0, categories_count: 0, books_count: 0 };
        } catch (error) {
            console.error('獲取統計失敗:', error);
            return { total_notes: 0, categories_count: 0, books_count: 0 };
        } finally {
            client.release();
        }
    }
    
    // 獲取用戶所有標籤
    async getUserTags(userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT DISTINCT jsonb_array_elements_text(tags) as tag
                FROM notes 
                WHERE user_id = $1 AND jsonb_array_length(tags) > 0
                ORDER BY tag
            `;
            
            const result = await client.query(query, [userId]);
            return result.rows.map(row => row.tag);
        } catch (error) {
            console.error('獲取標籤失敗:', error);
            return [];
        } finally {
            client.release();
        }
    }
    
    // 格式化筆記資料
    formatNote(note) {
        return {
            id: note.id,
            userId: note.user_id,
            title: note.title,
            content: note.content,
            bibleReference: note.bible_book ? {
                book: note.bible_book,
                bookZh: note.bible_book_zh,
                chapter: note.bible_chapter,
                verseStart: note.bible_verse_start,
                verseEnd: note.bible_verse_end,
                version: note.bible_version,
                text: note.bible_text
            } : null,
            tags: Array.isArray(note.tags) ? note.tags : (typeof note.tags === 'string' ? JSON.parse(note.tags) : []),
            category: note.category,
            color: note.color,
            isPublic: note.is_public,
            createdAt: note.created_at,
            updatedAt: note.updated_at
        };
    }
    
    // 關閉連接池
    async close() {
        await this.pool.end();
    }
}

// 初始化函數
async function initPostgreSQLDatabase() {
    try {
        // 檢查是否有 PostgreSQL 連接字串
        if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
            console.log('⚠️  未找到 PostgreSQL 連接字串，跳過 PostgreSQL 初始化');
            return false;
        }
        
        console.log('🔄 嘗試連接 PostgreSQL...');
        const db = new PostgreSQLNotesDB();
        
        // 測試連接
        await db.pool.query('SELECT 1');
        console.log('✅ PostgreSQL 連接測試成功');
        
        // 初始化資料庫表格
        await db.initDatabase();
        
        console.log('✅ PostgreSQL 筆記資料庫已初始化');
        return db;
    } catch (error) {
        console.error('❌ PostgreSQL 初始化失敗:', error.message);
        // 詳細錯誤資訊（僅在開發環境）
        if (process.env.NODE_ENV !== 'production') {
            console.error('詳細錯誤:', error);
        }
        return false;
    }
}

module.exports = {
    PostgreSQLNotesDB,
    initPostgreSQLDatabase
};
