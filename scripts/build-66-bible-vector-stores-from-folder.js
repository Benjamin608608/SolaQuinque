const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

/**
 * Build 66 vector stores (one per Bible book) from a local folder of TXT files.
 * - Reads local files in SOURCE_TEXT_DIR (env)
 * - Classifies files by Bible book using filename heuristics (EN/CN names + abbreviations)
 * - Creates/updates one vector store per book and uploads matching files
 * - Shows a simple textual progress bar in console
 *
 * Usage:
 *   OPENAI_API_KEY=... SOURCE_TEXT_DIR="/path/to/txt" node scripts/build-66-bible-vector-stores-from-folder.js
 * Optional env:
 *   BIBLE_STORE_PREFIX (default: "Bible-")
 */
(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    const SOURCE_TEXT_DIR = process.env.SOURCE_TEXT_DIR;
    if (!SOURCE_TEXT_DIR) {
      throw new Error('SOURCE_TEXT_DIR is required (local folder with TXT files)');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const STORE_PREFIX = process.env.BIBLE_STORE_PREFIX || 'Bible-';

    // Bible books with patterns (English, common abbreviations, Chinese full and short)
    const books = [
      { key: 'Genesis', patterns: ['genesis', '\\bgen\\.?\\b', '創世記', '\\b創\\b'] },
      { key: 'Exodus', patterns: ['exodus', '\\bexod?\\.?\\b', '出埃及記', '\\b出\\b'] },
      { key: 'Leviticus', patterns: ['leviticus', '\\blev\\.?\\b', '利未記', '\\b利\\b'] },
      { key: 'Numbers', patterns: ['numbers', '\\bnum\\.?\\b', '民數記', '\\b民\\b'] },
      { key: 'Deuteronomy', patterns: ['deuteronomy', '\\bdeut?\\.?\\b', '申命記', '\\b申\\b'] },
      { key: 'Joshua', patterns: ['joshua', '\\bjosh?\\.?\\b', '約書亞記', '約書亞'] },
      { key: 'Judges', patterns: ['judges', '\\bjudg?\\.?\\b', '士師記', '士師'] },
      { key: 'Ruth', patterns: ['\\bruth\\b', '路得記', '路得'] },
      { key: '1 Samuel', patterns: ['1\\s*sam(u?el)?\\.?', 'i\\s*sam', 'first\\s+samuel', '撒母耳記上', '撒上'] },
      { key: '2 Samuel', patterns: ['2\\s*sam(u?el)?\\.?', 'ii\\s*sam', 'second\\s+samuel', '撒母耳記下', '撒下'] },
      { key: '1 Kings', patterns: ['1\\s*kings?\\.?', 'i\\s*kgs?', 'first\\s+kings', '列王紀上', '王上'] },
      { key: '2 Kings', patterns: ['2\\s*kings?\\.?', 'ii\\s*kgs?', 'second\\s+kings', '列王紀下', '王下'] },
      { key: '1 Chronicles', patterns: ['1\\s*chron(icles)?\\.?', 'i\\s*chron', 'first\\s+chronicles', '歷代志上', '代上'] },
      { key: '2 Chronicles', patterns: ['2\\s*chron(icles)?\\.?', 'ii\\s*chron', 'second\\s+chronicles', '歷代志下', '代下'] },
      { key: 'Ezra', patterns: ['\\bezra\\b', '以斯拉記', '以斯拉'] },
      { key: 'Nehemiah', patterns: ['nehemiah', '\\bneh\\.?\\b', '尼希米記', '尼希米'] },
      { key: 'Esther', patterns: ['esther', '\\besth\\.?\\b', '以斯帖記', '以斯帖'] },
      { key: 'Job', patterns: ['\\bjob\\b', '約伯記', '約伯'] },
      { key: 'Psalms', patterns: ['psalms?', '\\bps\\.?\\b', '詩篇', '詩'] },
      { key: 'Proverbs', patterns: ['proverbs', '\\bprov?\\.?\\b', '箴言', '箴'] },
      { key: 'Ecclesiastes', patterns: ['ecclesiastes', '\\becc?\\.?\\b', '傳道書', '傳道', '傳'] },
      { key: 'Song of Songs', patterns: ['song\\s+of\\s+(songs|solomon)', '\\bcanticles\\b', '雅歌', '歌(中)?'] },
      { key: 'Isaiah', patterns: ['isaiah', '\\bisa\\.?\\b', '以賽亞書', '賽'] },
      { key: 'Jeremiah', patterns: ['jeremiah', '\\bjer\\.?\\b', '耶利米書', '耶'] },
      { key: 'Lamentations', patterns: ['lamentations', '\\blam\\.?\\b', '耶利米哀歌', '哀歌', '哀'] },
      { key: 'Ezekiel', patterns: ['ezekiel', '\\bezek?\\.?\\b', '以西結書', '結'] },
      { key: 'Daniel', patterns: ['daniel', '\\bdan\\.?\\b', '但以理書', '但'] },
      { key: 'Hosea', patterns: ['hosea', '\\bhose?\\.?\\b', '何西阿書', '何'] },
      { key: 'Joel', patterns: ['\\bjoel\\b', '約珥書', '約珥'] },
      { key: 'Amos', patterns: ['\\bamos\\b', '阿摩司書', '摩'] },
      { key: 'Obadiah', patterns: ['obadiah', '\\bobad?\\.?\\b', '俄巴底亞書', '俄'] },
      { key: 'Jonah', patterns: ['jonah', '\\bjon\\.?\\b', '約拿書', '拿'] },
      { key: 'Micah', patterns: ['micah', '\\bmic\\.?\\b', '彌迦書', '彌'] },
      { key: 'Nahum', patterns: ['nahum', '\\bnah\\.?\\b', '那鴻書', '鴻'] },
      { key: 'Habakkuk', patterns: ['habakkuk', '\\bhab\\.?\\b', '哈巴谷書', '哈'] },
      { key: 'Zephaniah', patterns: ['zephaniah', '\\bzeph?\\.?\\b', '西番雅書', '番'] },
      { key: 'Haggai', patterns: ['haggai', '\\bhag?\\.?\\b', '哈該書', '該'] },
      { key: 'Zechariah', patterns: ['zechariah', '\\bzech?\\.?\\b', '撒迦利亞書', '亞'] },
      { key: 'Malachi', patterns: ['malachi', '\\bmal\\.?\\b', '瑪拉基書', '瑪'] },
      { key: 'Matthew', patterns: ['matthew', '\\bmat?t?\\.?\\b', '馬太福音', '太'] },
      { key: 'Mark', patterns: ['\\bmark\\b', '\\bmk\\.?\\b', '馬可福音', '可'] },
      { key: 'Luke', patterns: ['\\bluke\\b', '\\blk\\.?\\b', '路加福音', '路'] },
      { key: 'John', patterns: ['\\bjohn\\b', '\\bjn\\.?\\b', '約翰福音', '約'] },
      { key: 'Acts', patterns: ['acts', 'apostles', '\\bact\\.?\\b', '使徒行傳', '徒'] },
      { key: 'Romans', patterns: ['romans', '\\brom\\.?\\b', '羅馬書', '羅'] },
      { key: '1 Corinthians', patterns: ['1\\s*cor(inthians)?\\.?', 'i\\s*cor', 'first\\s+corinthians', '哥林多前書', '林前'] },
      { key: '2 Corinthians', patterns: ['2\\s*cor(inthians)?\\.?', 'ii\\s*cor', 'second\\s+corinthians', '哥林多後書', '林後'] },
      { key: 'Galatians', patterns: ['galatians', '\\bgal\\.?\\b', '加拉太書', '加'] },
      { key: 'Ephesians', patterns: ['ephesians', '\\beph\\.?\\b', '以弗所書', '弗'] },
      { key: 'Philippians', patterns: ['philippians', '\\bphil\\.?\\b', '腓立比書', '腓'] },
      { key: 'Colossians', patterns: ['colossians', '\\bcol\\.?\\b', '歌羅西書', '西'] },
      { key: '1 Thessalonians', patterns: ['1\\s*thess(alonians)?\\.?', 'i\\s*thess', 'first\\s+thessalonians', '帖撒羅尼迦前書', '帖前'] },
      { key: '2 Thessalonians', patterns: ['2\\s*thess(alonians)?\\.?', 'ii\\s*thess', 'second\\s+thessalonians', '帖撒羅尼迦後書', '帖後'] },
      { key: '1 Timothy', patterns: ['1\\s*tim(othy)?\\.?', 'i\\s*tim', 'first\\s+timothy', '提摩太前書', '提前'] },
      { key: '2 Timothy', patterns: ['2\\s*tim(othy)?\\.?', 'ii\\s*tim', 'second\\s+timothy', '提摩太後書', '提後'] },
      { key: 'Titus', patterns: ['\\btitus\\b', '提多書', '多'] },
      { key: 'Philemon', patterns: ['philemon', '\\bphlm?\\.?\\b', '腓利門書', '門'] },
      { key: 'Hebrews', patterns: ['hebrews', '\\bheb\\.?\\b', '希伯來書', '來'] },
      { key: 'James', patterns: ['\\bjames\\b', '\\bjas\\.?\\b', '雅各書', '雅'] },
      { key: '1 Peter', patterns: ['1\\s*peter\\b|1\\s*pet\\.?', 'i\\s*pet', 'first\\s+peter', '彼得前書', '彼前'] },
      { key: '2 Peter', patterns: ['2\\s*peter\\b|2\\s*pet\\.?', 'ii\\s*pet', 'second\\s+peter', '彼得後書', '彼後'] },
      { key: '1 John', patterns: ['1\\s*john\\b|1\\s*jn\\.?', 'i\\s*jn', 'first\\s+john', '約翰一書', '約一'] },
      { key: '2 John', patterns: ['2\\s*john\\b|2\\s*jn\\.?', 'ii\\s*jn', 'second\\s+john', '約翰二書', '約二'] },
      { key: '3 John', patterns: ['3\\s*john\\b|3\\s*jn\\.?', 'iii\\s*jn', 'third\\s+john', '約翰三書', '約三'] },
      { key: 'Jude', patterns: ['\\bjude\\b', '\\bjud\\.?\\b', '猶大書', '猶'] },
      { key: 'Revelation', patterns: ['revelation', 'apocalypse', '\\brev\\.?\\b', '啟示錄', '啟'] },
    ];

    const bookRegex = books.map(b => ({
      key: b.key,
      regexes: b.patterns.map(p => new RegExp(p, 'i'))
    }));

    function printProgress(current, total, label) {
      const width = 30;
      const ratio = Math.max(0, Math.min(1, total === 0 ? 0 : current / total));
      const filled = Math.round(ratio * width);
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
      process.stdout.write(`\r${label} [${bar}] ${current}/${total}`);
      if (current === total) process.stdout.write('\n');
    }

    async function listTxtFilesRecursive(root) {
      const results = [];
      async function walk(dir) {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else if (/\.txt$/i.test(e.name)) results.push(full);
        }
      }
      await walk(root);
      return results;
    }

    console.log(`📂 Scanning local folder: ${SOURCE_TEXT_DIR}`);
    const allFiles = await listTxtFilesRecursive(SOURCE_TEXT_DIR);
    if (allFiles.length === 0) {
      console.log('⚠️ No .txt files found. Abort.');
      process.exit(0);
    }
    console.log(`🧾 Found ${allFiles.length} .txt files`);

    // Classify local files by book
    const bookToPaths = new Map();
    for (const { key } of books) bookToPaths.set(key, []);
    for (const filePath of allFiles) {
      const name = path.basename(filePath).toLowerCase();
      for (const b of bookRegex) {
        if (b.regexes.some(r => r.test(name))) {
          bookToPaths.get(b.key).push(filePath);
        }
      }
    }

    // Helper: find existing vector store by name
    async function findVectorStoreByName(name) {
      let after = undefined;
      while (true) {
        const resp = await openai.vectorStores.list({ limit: 100, after });
        const found = resp.data.find(vs => (vs.name || '').toLowerCase() === name.toLowerCase());
        if (found) return found;
        if (!resp.has_more) return null;
        after = resp.last_id;
      }
    }

    // Build per-book
    const booksWithFiles = books.filter(b => (bookToPaths.get(b.key) || []).length > 0);
    const totalSteps = booksWithFiles.length;
    let step = 0;
    for (const book of books) {
      const paths = bookToPaths.get(book.key) || [];
      if (paths.length === 0) {
        continue;
      }

      step++;
      printProgress(step - 1, totalSteps, `Preparing`);
      const vsName = `${STORE_PREFIX}${book.key}`;
      let target = await findVectorStoreByName(vsName);
      if (!target) {
        console.log(`\n🆕 Creating vector store: ${vsName} with ${paths.length} files`);
        target = await openai.vectorStores.create({ name: vsName });
      } else {
        console.log(`\n♻️ Updating vector store: ${vsName} with ${paths.length} files`);
      }

      // Try fast path: uploadAndPoll (SDK >= 4.20)
      try {
        const streams = paths.map(p => fs.createReadStream(p));
        console.log(`⬆️  Uploading ${streams.length} files to ${vsName} (batch)`);
        const batch = await openai.vectorStores.fileBatches.uploadAndPoll(target.id, { files: streams });
        console.log(`✅ ${book.key}: batch status = ${batch.status}`);
      } catch (fastErr) {
        console.warn(`⚠️ uploadAndPoll not available or failed for ${book.key}, fallback upload... (${fastErr.message})`);
        // Fallback: upload first → then attach by file_ids
        const fileIds = [];
        let uploaded = 0;
        for (const p of paths) {
          try {
            const file = await openai.files.create({ file: fs.createReadStream(p), purpose: 'assistants' });
            fileIds.push(file.id);
          } catch (e) {
            console.warn(`  ✖ upload failed: ${path.basename(p)} → ${e.message}`);
          }
          uploaded++;
          printProgress(uploaded, paths.length, `Uploading ${book.key}`);
        }
        const batch = await openai.vectorStores.fileBatches.create(target.id, { file_ids: fileIds });
        // Polling
        let tries = 0;
        while (tries < 60) {
          const bstat = await openai.vectorStores.fileBatches.retrieve(target.id, batch.id);
          if (bstat.status === 'completed' || bstat.status === 'failed' || bstat.status === 'cancelled') {
            console.log(`\n✅ ${book.key}: batch status = ${bstat.status}`);
            break;
          }
          await new Promise(r => setTimeout(r, 5000));
          tries++;
        }
      }

      printProgress(step, totalSteps, `Books processed`);
    }

    console.log('\n🎉 Done building per-book vector stores from local folder');
  } catch (err) {
    console.error('❌ Failed to build per-book vector stores from folder:', err.message);
    process.exit(1);
  }
})();


