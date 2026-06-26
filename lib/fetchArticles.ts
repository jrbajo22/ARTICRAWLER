import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'articles.json');

interface Article {
  title: string;
  abstract: string;
  link: string;
  published: string | Date;
  authors: string;
  source: string;
}

/**
 * Fetches recent articles from arXiv for the past week.
 * @returns Promise<Article[]>
 */
export async function fetchRecentArticles(): Promise<Article[]> {
  // Calculate date one week ago
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const dateFormat = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0]; // YYYYMMDDHHmmss
  };
  const startDate = dateFormat(oneWeekAgo);
  const endDate = dateFormat(new Date());

  // arXiv API query: search for all categories submitted in the last week
  // We'll search across all categories (cat:all) and submittedDate range
  const query = `submittedDate:[${startDate}0000 TO ${endDate}2359]&max_results=100`;
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=100`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }
    const xml = await response.text();

    // Simple parsing of XML entries using regex (for demonstration)
    // In production, use a proper XML parser.
    const entries: any[] = [];
    const entryMatches = xml.match(/<entry>([\s\S]*?)<\/entry>/g);
    if (entryMatches) {
      for (const entry of entryMatches) {
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
        const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
        const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
        const authorMatch = entry.match(/<author><name>([\s\S]*?)<\/name><\/author>/g);
        const categoryMatch = entry.match(/<category\s+term=\"([^\"]+)\"/);

        const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';
        const abstract = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : '';
        const link = idMatch ? idMatch[1] : '';
        const published = publishedMatch ? new Date(publishedMatch[1]) : new Date();
        const authors = authorMatch ? authorMatch.map(a => a.match(/<name>([\s\S]*?)<\/name>/)?.[1] || '').join(', ') : '';
        const source = `arXiv:${categoryMatch?.[1] || ''}`;

        if (title && abstract && link) {
          entries.push({
            title,
            abstract,
            link,
            published,
            authors,
            source,
          });
        }
      }
    }

    return entries;
  } catch (error) {
    console.error('Error fetching articles from arXiv:', error);
    return [];
  }
}

/**
 * Updates the local articles.json with newly fetched articles.
 * @param newArticles
 */
export async function updateArticles(newArticles: Article[]) {
  try {
    // Read existing articles
    let existingArticles: Article[] = [];
    try {
      const data = await fs.promises.readFile(DB_PATH, 'utf8');
      existingArticles = JSON.parse(data);
    } catch (err) {
      // If file doesn't exist or is empty, start with empty array
      existingArticles = [];
    }

    // Merge: avoid duplicates by link
    const existingLinks = new Set(existingArticles.map(a => a.link));
    const uniqueNewArticles = newArticles.filter(a => !existingLinks.has(a.link));
    const allArticles = [...existingArticles, ...uniqueNewArticles];

    // Sort by published date descending
    allArticles.sort((a, b) => {
      const dateA = a.prompt instanceof Date ? a.published : new Date(a.published as string);
      const dateB = b.published instanceof Date ? b.published : new Date(b.published as string);
      return dateB.getTime() - dateA.getTime();
    });

    // Write back to file
    await fs.promises.writeFile(DB_PATH, JSON.stringify(allArticles, null, 2), 'utf8');
    console.log(`Updated articles.json with ${uniqueNewArticles.length} new articles. Total: ${allArticles.length}`);
  } catch (error) {
    console.error('Error updating articles:', error);
  }
}

// If this script is run directly, fetch and update.
if (require.main === module) {
  (async () => {
    const articles = await fetchRecentArticles();
    await updateArticles(articles);
    process.exit(0);
  })();
}