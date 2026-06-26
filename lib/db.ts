import { promises as fs } from 'fs';
import * as path from 'path';
import { refreshArticlesIfNeeded } from './articleFetcher';

const DB_PATH = path.join(process.cwd(), 'data', 'articles.json');

interface Article {
  title: string;
  abstract: string;
  link: string;
  published: string | Date; // stored as string (ISO) but can be Date
  authors: string;
  source: string;
  // any other fields you might have
}

// Ensure data directory exists
async function ensureDir() {
  const dataDir = path.dirname(DB_PATH);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {
    // ignore if already exists
  }
}

// Initialize DB if not exists
async function init() {
  await ensureDir();
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify([]), 'utf8');
  }
}

/**
 * Get all articles, ensuring they are fresh if needed.
 */
export async function getAll(): Promise<Article[]> {
  await init();
  // Optionally refresh articles if stale (once per day)
  // We'll do a lightweight check: if file is empty or older than 1 day, refresh.
  try {
    const stats = await fs.stat(DB_PATH);
    const oneDay = 24 * 60 * 60 * 1000;
    const isOld = Date.now() - stats.mtime.getTime() > oneDay;
    if (isOld) {
      // Refresh in background; we don't want to block the request too long.
      // We'll call refresh but not await to avoid delaying response.
      // However, we need to avoid multiple concurrent refreshes.
      // For simplicity, we'll just call it and let it run; if it's still old,
      // next request will trigger again.
      // We'll fire and forget.
      refreshArticlesIfNeeded().catch(console.error);
    }
  } catch (err) {
    // If any error, we still try to read the file.
  }

  const data = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(data);
}

/**
 * Find article by link
 */
export async function findByLink(link: string): Promise<Article | null> {
  const articles = await getAll();
  return articles.find(a => a.link === link) ?? null;
}

/**
 * Insert article
 */
export async function insert(article: Article): Promise<void> {
  const articles = await getAll();
  articles.push(article);
  await fs.writeFile(DB_PATH, JSON.stringify(articles, null, 2), 'utf8');
}

/**
 * Update article
 */
export async function update(link: string, updates: Partial<Article>): Promise<void> {
  const articles = await getAll();
  const idx = articles.findIndex(a => a.link === link);
  if (idx !== -1) {
    articles[idx] = { ...articles[idx], ...updates };
    await fs.writeFile(DB_PATH, JSON.stringify(articles, null, 2), 'utf8');
  }
}

/**
 * Search articles by title or abstract (case-insensitive, word-based matching with stemming-like behavior)
 */
export async function search(query: string): Promise<Article[]> {
  const articles = await getAll();
  // Split query into words, remove non-alphanumeric, lowercase, and filter out short words
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace non-word/space with space
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2); // ignore words of length 2 or less

  // If no meaningful words, fall back to original substring search on the whole query
  if (queryWords.length === 0) {
    return articles.filter(a =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.abstract.toLowerCase().includes(query.toLowerCase())
    );
  }

  return articles.filter(article => {
    // Prepare title and abstract words
    const titleWords = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 0);
    const abstractWords = article.abstract
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    // Check if any query word matches any title or abstract word
    return queryWords.some(qWord =>
      titleWords.some(tWord =>
        qWord === tWord || qWord.startsWith(tWord) || tWord.startsWith(qWord)
      ) ||
      abstractWords.some(aWord =>
        qWord === aWord || qWord.startsWith(aWord) || aWord.startsWith(qWord)
      )
    );
  });
}