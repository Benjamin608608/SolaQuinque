const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 確保 data 目錄存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化 SQLite 資料庫
const dbPath = path.join(dataDir, 'notes.db');
const db = new Database(dbPath);

// 啟用 WAL 模式以提高並發性能
db.pragma('journal_mode = WAL');

// 建立筆記資料表
const createNotesTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            tags TEXT DEFAULT '[]',
            category TEXT DEFAULT 'default',
            color TEXT DEFAULT 'blue',
            is_public BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    db.exec(sql);
    console.log('✅ 筆記資料表已建立');
};

// 建立索引以提高查詢效能
const createIndexes = () => {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_user_notes ON notes(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_bible_ref ON notes(bible_book, bible_chapter)',
        'CREATE INDEX IF NOT EXISTS idx_category ON notes(category)',
        'CREATE INDEX IF NOT EXISTS idx_created_at ON notes(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_public ON notes(is_public)'
    ];
    
    indexes.forEach(indexSql => {
        db.exec(indexSql);
    });
    
    console.log('✅ 資料庫索引已建立');
};

// 筆記資料庫操作類
class NotesDB {
    constructor() {
        this.db = db;
        this.initStatements();
    }
    
    // 預編譯 SQL 語句以提高效能
    initStatements() {
        this.statements = {
            // 建立筆記
            create: this.db.prepare(`
                INSERT INTO notes (
                    user_id, title, content, bible_book, bible_book_zh, 
                    bible_chapter, bible_verse_start, bible_verse_end, 
                    bible_version, bible_text, tags, category, color, is_public
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),
            
            // 獲取用戶所有筆記
            getUserNotes: this.db.prepare(`
                SELECT * FROM notes 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            `),
            
            // 獲取特定筆記
            getById: this.db.prepare(`
                SELECT * FROM notes 
                WHERE id = ? AND user_id = ?
            `),
            
            // 更新筆記
            update: this.db.prepare(`
                UPDATE notes 
                SET title = ?, content = ?, tags = ?, category = ?, 
                    color = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `),
            
            // 刪除筆記
            delete: this.db.prepare(`
                DELETE FROM notes 
                WHERE id = ? AND user_id = ?
            `),
            
            // 搜尋筆記
            search: this.db.prepare(`
                SELECT * FROM notes 
                WHERE user_id = ? AND (
                    title LIKE ? OR 
                    content LIKE ? OR 
                    bible_text LIKE ?
                )
                ORDER BY created_at DESC
            `),
            
            // 按分類獲取筆記
            getByCategory: this.db.prepare(`
                SELECT * FROM notes 
                WHERE user_id = ? AND category = ?
                ORDER BY created_at DESC
            `),
            
            // 按聖經章節獲取筆記
            getByBibleRef: this.db.prepare(`
                SELECT * FROM notes 
                WHERE user_id = ? AND bible_book = ? AND bible_chapter = ?
                ORDER BY created_at DESC
            `),
            
            // 獲取用戶統計資訊
            getUserStats: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_notes,
                    COUNT(DISTINCT category) as categories_count,
                    COUNT(DISTINCT bible_book) as books_count
                FROM notes 
                WHERE user_id = ?
            `),
            
            // 獲取用戶所有標籤
            getUserTags: this.db.prepare(`
                SELECT DISTINCT tags FROM notes 
                WHERE user_id = ? AND tags != '[]'
            `)
        };
    }
    
    // 建立新筆記
    createNote(noteData) {
        try {
            const result = this.statements.create.run(
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
                noteData.isPublic ? 1 : 0
            );
            
            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('建立筆記失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 獲取用戶筆記
    getUserNotes(userId) {
        try {
            const notes = this.statements.getUserNotes.all(userId);
            return notes.map(this.formatNote);
        } catch (error) {
            console.error('獲取筆記失敗:', error);
            return [];
        }
    }
    
    // 獲取特定筆記
    getNoteById(id, userId) {
        try {
            const note = this.statements.getById.get(id, userId);
            return note ? this.formatNote(note) : null;
        } catch (error) {
            console.error('獲取筆記失敗:', error);
            return null;
        }
    }
    
    // 更新筆記
    updateNote(id, userId, updateData) {
        try {
            const result = this.statements.update.run(
                updateData.title,
                updateData.content,
                JSON.stringify(updateData.tags || []),
                updateData.category || 'default',
                updateData.color || 'blue',
                updateData.isPublic ? 1 : 0,
                id,
                userId
            );
            
            return { success: result.changes > 0 };
        } catch (error) {
            console.error('更新筆記失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 刪除筆記
    deleteNote(id, userId) {
        try {
            const result = this.statements.delete.run(id, userId);
            return { success: result.changes > 0 };
        } catch (error) {
            console.error('刪除筆記失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 搜尋筆記
    searchNotes(userId, query) {
        try {
            const searchTerm = `%${query}%`;
            const notes = this.statements.search.all(userId, searchTerm, searchTerm, searchTerm);
            return notes.map(this.formatNote);
        } catch (error) {
            console.error('搜尋筆記失敗:', error);
            return [];
        }
    }
    
    // 按分類獲取筆記
    getNotesByCategory(userId, category) {
        try {
            const notes = this.statements.getByCategory.all(userId, category);
            return notes.map(this.formatNote);
        } catch (error) {
            console.error('獲取分類筆記失敗:', error);
            return [];
        }
    }
    
    // 按聖經章節獲取筆記
    getNotesByBibleRef(userId, book, chapter) {
        try {
            const notes = this.statements.getByBibleRef.all(userId, book, chapter);
            return notes.map(this.formatNote);
        } catch (error) {
            console.error('獲取聖經筆記失敗:', error);
            return [];
        }
    }
    
    // 獲取用戶統計
    getUserStats(userId) {
        try {
            return this.statements.getUserStats.get(userId);
        } catch (error) {
            console.error('獲取統計失敗:', error);
            return { total_notes: 0, categories_count: 0, books_count: 0 };
        }
    }
    
    // 獲取用戶所有標籤
    getUserTags(userId) {
        try {
            const rows = this.statements.getUserTags.all(userId);
            const allTags = new Set();
            
            rows.forEach(row => {
                try {
                    const tags = JSON.parse(row.tags);
                    tags.forEach(tag => allTags.add(tag));
                } catch (e) {
                    // 忽略無效的 JSON
                }
            });
            
            return Array.from(allTags).sort();
        } catch (error) {
            console.error('獲取標籤失敗:', error);
            return [];
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
            tags: JSON.parse(note.tags || '[]'),
            category: note.category,
            color: note.color,
            isPublic: Boolean(note.is_public),
            createdAt: note.created_at,
            updatedAt: note.updated_at
        };
    }
    
    // 關閉資料庫連接
    close() {
        this.db.close();
    }
}

// 初始化資料庫
const initDatabase = () => {
    try {
        createNotesTable();
        createIndexes();
        console.log('✅ 筆記資料庫初始化完成');
        return true;
    } catch (error) {
        console.error('❌ 資料庫初始化失敗:', error);
        return false;
    }
};

// 匯出
module.exports = {
    db,
    NotesDB,
    initDatabase
};
