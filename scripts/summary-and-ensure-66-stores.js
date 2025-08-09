const OpenAI = require('openai');

(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
    const STORE_PREFIX = process.env.BIBLE_STORE_PREFIX || 'Bible-';
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const books = [
      'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
      '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Songs','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
      'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
    ];

    async function listAllStores() {
      const all = [];
      let after = undefined;
      while (true) {
        const r = await openai.vectorStores.list({ limit: 100, after });
        all.push(...r.data);
        if (!r.has_more) break;
        after = r.last_id;
      }
      return all;
    }

    function findByName(list, name) {
      const norm = (s) => (s || '').toLowerCase();
      return list.find(v => norm(v.name) === norm(name));
    }

    const all = await listAllStores();
    const wantNames = books.map(b => `${STORE_PREFIX}${b}`);
    const have = new Map();
    for (const vs of all) have.set((vs.name || ''), vs.id);

    const missing = wantNames.filter(n => !have.has(n));
    console.log(`Existing with prefix '${STORE_PREFIX}': ${wantNames.length - missing.length}/${wantNames.length}`);
    if (missing.length) {
      console.log('Creating missing:');
      for (const name of missing) {
        const created = await openai.vectorStores.create({ name });
        console.log(`  + ${name}  → ${created.id}`);
      }
    } else {
      console.log('No missing stores.');
    }

    // Print final summary
    const all2 = await listAllStores();
    const haveNames = new Set(all2.map(v => v.name));
    const finalMissing = wantNames.filter(n => !haveNames.has(n));
    console.log('\nFinal status:');
    console.log(`  Total expected: ${wantNames.length}`);
    console.log(`  Total present: ${wantNames.length - finalMissing.length}`);
    if (finalMissing.length) {
      console.log('  Still missing:');
      for (const name of finalMissing) console.log('   - ' + name);
    } else {
      console.log('  All 66 stores are present.');
    }
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
})();


