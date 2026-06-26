import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { findByLink, insert } from '../../../lib/db';

// Function to fetch articles from arXiv for a given date range
async function fetchArxivPosts(startDate: Date, endDate: Date) {
  // Format dates for arXiv query (YYYYMMDD)
  const formatDate = (date: Date) => {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  };

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  // arXiv API uses submittedDate:[start TO end]
  const query = `submittedDate:[${startStr}0000 TO ${endStr}235959]`;
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=100`;

  try {
    const response = await axios.get(url);
    const xml = response.data;

    // Simple XML parsing using regex (for demo; in production use proper XML parser)
    const entries: any[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryText = match[1];
      const titleMatch = entryText.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entryText.match(/<summary>([\s\S]*?)<\/summary>/);
      const idMatch = entryText.match(/<id>([\s\S]*?)<\/id>/);
      const publishedMatch = entryText.match(/<published>([\s\S]*?)<\/published>/);
      const authorMatches = [...entryText.matchAll(/<author><name>([\s\S]*?)<\/name><\/author>/g)];
      const authors = authorMatches.map(m => m[1]);

      if (titleMatch && summaryMatch && idMatch && publishedMatch) {
        entries.push({
          title: titleMatch[1].trim(),
          abstract: summaryMatch[1].trim(),
          link: idMatch[1].trim(),
          published: new Date(publishedMatch[1].trim()),
          authors: authors.join(', '),
          source: 'arXiv'
        });
      }
    }
    return entries;
  } catch (error) {
    console.error('Error fetching from arXiv:', error);
    return [];
  }
}

// Function to save articles to database (using our simple JSON DB)
async function saveArticles(articles: any[]) {
  let newCount = 0;
  for (const article of articles) {
    const existing = await findByLink(article.link);
    if (!existing) {
      await insert(article);
      newCount++;
    }
  }
  return newCount;
}

export async function POST(request: NextRequest) {
  try {
    // Define the date range: week of May 10, 2020 (May 10 to May 16, 2020)
    const startDate = new Date('2020-05-10');
    const endDate = new Date('2020-05-16');

    // Fetch articles from arXiv
    const articles = await fetchArxivPosts(startDate, endDate);

    // Save articles to database, avoiding duplicates
    const savedCount = await saveArticles(articles);

    return NextResponse.json({
      success: true,
      message: `Fetched and saved ${savedCount} new articles from arXiv for the week of May 10-16, 2020.`,
      totalFetched: articles.length
    });
  } catch (error) {
    console.error('Error in ingest route:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to ingest articles' },
      { status: 500 }
    );
  }
}