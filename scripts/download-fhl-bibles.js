#!/usr/bin/env node

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function getFetch() {
  if (typeof fetch !== 'undefined') return fetch;
  try {
    const mod = await import('node-fetch');
    return mod.default;
  } catch (err) {
    throw new Error('Fetch is not available. Use Node 18+ or install node-fetch.');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function fetchJson(fetchFn, url, params = undefined, retries = 3) {
  const qs = params
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const fullUrl = url + qs;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchFn(fullUrl, { headers: { 'accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function fetchText(fetchFn, url) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function parseListAllCsv(text) {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  // Each line format (observed): idx,EngShort,EnglishFull,ChineseShort,ChineseFull,EngShortShort
  const records = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const idx = Number(parts[0]);
    const engShort = parts[1];
    const englishName = parts[2] || '';
    const chineseShort = parts[3] || '';
    const chineseFull = parts[4] || '';
    const engShortShort = parts[5] || '';
    records.push({ idx, engShort, engShortShort, englishName, chineseShort, chineseFull });
  }
  // sort by idx just in case
  records.sort((a, b) => a.idx - b.idx);
  return records;
}

async function main() {
  const fetchFn = await getFetch();

  const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'data', 'fhl-bible');
  const INCLUDE_RESTRICTED = process.env.INCLUDE_RESTRICTED === '1';
  const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || '150');
  const MAX_VERSIONS = process.env.MAX_VERSIONS ? Number(process.env.MAX_VERSIONS) : undefined;
  const ONLY_VERSIONS = process.env.ONLY_VERSIONS ? process.env.ONLY_VERSIONS.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  await ensureDir(OUTPUT_DIR);

  const base = 'https://bible.fhl.net/json/';
  console.log('Fetching versions (ab.php)...');
  const ab = await fetchJson(fetchFn, base + 'ab.php');
  if (ab.status !== 'success') throw new Error('ab.php not success');
  const versionsBasic = ab.record.map((r) => ({ book: r.book, cname: r.cname }));

  console.log('Fetching versions (abv.php) for candownload flags...');
  const abv = await fetchJson(fetchFn, base + 'abv.php');
  if (abv.status !== 'success') throw new Error('abv.php not success');
  const canDownloadSet = new Set(abv.record.filter((r) => r.candownload === 1).map((r) => r.book));

  let versions = versionsBasic;
  if (!INCLUDE_RESTRICTED) {
    versions = versions.filter((v) => canDownloadSet.has(v.book));
  }
  if (ONLY_VERSIONS && ONLY_VERSIONS.length > 0) {
    const onlySet = new Set(ONLY_VERSIONS);
    versions = versions.filter((v) => onlySet.has(v.book));
  }
  if (MAX_VERSIONS) {
    versions = versions.slice(0, MAX_VERSIONS);
  }

  if (versions.length === 0) {
    console.log('No versions selected. Exiting.');
    return;
  }
  console.log(`Selected ${versions.length} versions.`);

  console.log('Fetching books list (listall.html)...');
  const listAllText = await fetchText(fetchFn, base + 'listall.html');
  const books = parseListAllCsv(listAllText);
  console.log(`Books: ${books.length}`);

  const startTime = Date.now();

  for (const { book: versionCode, cname } of versions) {
    const outFile = path.join(OUTPUT_DIR, `${versionCode}.txt`);
    console.log(`\n== Processing version ${versionCode} - ${cname} ==`);

    // Initialize file with header
    const header = `Version: ${versionCode} - ${cname}\nGenerated: ${new Date().toISOString()}\nSource: ${base}\nNote: Content may be subject to licensing; see https://www.fhl.net/main/fhl/fhl8.html\n\n`;
    await fsp.writeFile(outFile, header, { encoding: 'utf8' });

    for (const book of books) {
      const bookHeader = `# ${book.englishName || book.engShort} (${book.chineseFull || book.chineseShort || ''})\n`;
      await fsp.appendFile(outFile, bookHeader);

      let chapter = 1;
      while (true) {
        // Fetch chapter
        const params = { engs: book.engShort, chap: String(chapter), version: versionCode };
        let data;
        try {
          data = await fetchJson(fetchFn, base + 'qb.php', params);
        } catch (err) {
          console.warn(`Fetch error for ${versionCode} ${book.engShort} ${chapter}: ${String(err)}`);
          // retry once after small delay
          await sleep(1000);
          try {
            data = await fetchJson(fetchFn, base + 'qb.php', params);
          } catch (err2) {
            console.warn(`Retry failed for ${versionCode} ${book.engShort} ${chapter}: ${String(err2)}. Skipping chapter.`);
            break;
          }
        }

        if (!data || data.record_count === 0 || !Array.isArray(data.record) || data.record.length === 0) {
          // No more chapters for this book
          break;
        }

        // Write chapter header
        await fsp.appendFile(outFile, `\n${book.engShort} ${chapter}\n`);
        for (const rec of data.record) {
          const verseLine = `${rec.chap}:${rec.sec} ${rec.bible_text || ''}`.replace(/\s+/g, ' ').trim();
          await fsp.appendFile(outFile, verseLine + '\n');
        }

        chapter += 1;
        if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
      }

      await fsp.appendFile(outFile, '\n');
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    }
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(2);
  console.log(`Done. Elapsed ${elapsedMin} min. Output at ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});