import { promises as fs } from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';
const DATA_DIR = path.join(process.cwd(), 'data');
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json');
const LAST_FETCH_PATH = path.join(DATA_DIR, 'lastFetch.txt');

interface Article {
  title: string;
  abstract: string;
  link: string;
  published: string | Date;
  authors: string;
  source: string;
}

/**
 * Fetches recent articles from arXiv for the last week.
 * @returns Promise<Array<Article>> of fetched articles.
 */
export async function fetchRecentArxivArticles(): Promise<Article[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const startDate = oneWeekAgo.toISOString().replace(/[-:]/g, '').slice(0, 12) + '000'; // YYYYMMDDHHMM
  const endDate = new Date().toISOString().replace(/[-:]/g, '').slice(0, 12) + '000';

  const query = `submittedDate:[${startDate}000 TO ${endDate}999]`; // arXiv expects YYYYMMDDHHMMSS

  const url = `${ARXIV_API_URL}?search_query=${encodeURIComponent(query)}&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    const json = await parseStringPromise(xml, { explicitArray: false, trim: true });

    const feed = json.feed;
    if (!feed || !feed.entry) {
      return [];
    }

    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    const articles: Article[] = entries.map((entry: any) => {
      // Authors can be a single object or array
      const authors = Array.isArray(entry.author)
        ? entry.author.map((a: any) => a.name || '').join(', ')
        : (entry.author?.name || '') || '';

      return {
        title: entry.title?.trim() || '',
        abstract: entry.summary?.trim() || '',
        link: entry.id?.trim() || '',
        published: entry.published ? new Date(entry.published) : new Date(),
        authors,
        source: 'arXiv',
      };
    });

    return articles;
  } catch (error) {
    console.error('Error fetching arXiv articles:', error);
    return [];
  }
}

/**
 * Loads the last fetch timestamp from file.
 * @returns Promise<Date | null>
 */
async function getLastFetchTime(): Promise<Date | null> {
  try {
    const data = await fs.readFile(LAST_FETCH_PATH, 'utf8');
    const timestamp = parseInt(data.trim(), 10);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves the current timestamp as the last fetch time.
 */
async function setLastFetchTime(): Promise<void> {
  await fs.writeFile(LAST_FETCH_PATH, Date.now().toString(), 'utf8');
}

/**
 * Checks if we should fetch new articles (based on last fetch time being more than 24 hours ago).
 * @returns Promise<boolean>
 */
async function shouldFetch(): Promise<boolean> {
  const lastFetch = await getLastFetchTime();
  if (!lastFetch) return true;
  const now = new Date();
  const diffHours = (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60);
  return diffHours >= 24; // fetch once per day
}

/**
 * Main function to fetch and save new articles if needed.
 * Merges new articles with existing ones, avoiding duplicates by link.
 */
export async function refreshArticlesIfNeeded(): Promise<void> {
  if (!(await shouldFetch())) {
    console.log('Articles are up to date, skipping fetch.');
    return;
  }

  console.log('Fetching recent articles from arXiv...');
  const newArticles = await fetchRecentArxivArticles();
  if (newArticles.length === 0) {
    console.log('No new articles fetched.');
    return;
  }

  // Load existing articles
  let existingArticles: Article[] = [];
  try {
    const data = await fs.readFile(ARTICLES_PATH, 'utf8');
    existingArticles = JSON.parse(data);
  } catch {
    // If file doesn't exist or is invalid, start with empty array
    existingArticles = [];
  }

  // Create a map of existing links for deduplication
  const existingLinkMap = new Map<string, Article>();
  existingArticles.forEach(article => {
    if (article.link) {
      existingLinkMap.set(article.link, article);
    }
  });

  // Add new articles
  let addedCount = 0;
  for (const article of newArticles) {
    if (article.link && !existingLinkMap.has(article.link)) {
      existingLinkMap.set(article.link, article);
      addedCount++;
    }
  }

  // Convert back to array
  const allArticles = Array.from(existingLinkMap.values());

  // Save back to file
  await fs.writeFile(ARTICLES_PATH, JSON.stringify(allArticles, null, 2), 'utf8');
  await setLastFetchTime();

  console.log(`Added ${addedCount} new articles. Total articles: ${allArticles.length}`);
}

// If this script is run directly, execute the refresh.
if (require.main === module) {
  refreshArticlesIfNeeded().catch(console.error);
}