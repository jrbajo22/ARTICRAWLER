import { NextRequest, NextResponse } from 'next/server';
import { search } from '../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message' },
        { status: 400 }
      );
    }

    // Search for relevant articles (simple search in title and abstract)
    const articles = await search(message);

    // Construct context from articles (limit to 2 most recent)
    let context = '';
    if (articles.length > 0) {
      // Sort by published descending (most recent first)
      const sorted = [...articles].sort((a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime()
      );
      const topArticles = sorted.slice(0, 2);
      context = 'Here are some relevant recent articles that may help answer the question:\n\n';
      topArticles.forEach((article: any, index: number) => {
        const pubDate = article.published ? new Date(article.published) : new Date();
        context += `${index + 1}. Title: ${article.title}\n`;
        context += `   Published: ${pubDate.toLocaleDateString()}, Source: ${article.source}\n`;
        // Truncate abstract to avoid overly long prompts
        const abstract = article.abstract.length > 500 ? article.abstract.substring(0, 500) + '...' : article.abstract;
        context += `   Abstract: ${abstract}\n\n`;
      });
    } else {
      context = 'No relevant articles found in the database for the given query.\n\n';
    }

    // Prepare the prompt for the NVIDIA Nims API
    const prompt = `${context}Now, based on the above information, please answer the following question: ${message}`;

    // Call the NVIDIA Nims API (Qwen 3.5 397B) using OpenAI-compatible endpoint
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;
    if (!nvidiaApiKey) {
      throw new Error('NVIDIA API key not configured');
    }

    // Try the OpenAI-compatible endpoint that NVIDIA NIMs provide
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nvidiaApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.5-397b-a17b', // adjust if needed
        messages: [
          { role: 'system', content: [{ type: 'text', text: 'You are a helpful assistant that answers questions based on provided context.' }] },
          { role: 'user', content: [{ type: 'text', text: prompt }] }
        ],
        temperature: 0.7,
        max_tokens: 500,
        // stream: false
      })
    });

    // If the above endpoint fails, fallback to the original endpoint
    let data;
    if (!response.ok) {
      console.warn('Primary NVIDIA endpoint failed, trying fallback...');
      const fallbackResponse = await fetch('https://api.nvcf.nvidia.com/v2/nvcf/pexec/function/completion', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.5-397b-a17b',
          prompt: prompt,
          max_tokens: 500,
          temperature: 0.7
        })
      });
      if (!fallbackResponse.ok) {
        const errorData = await fallbackResponse.text();
        throw new Error(`NVIDIA API error: ${fallbackResponse.status} ${errorData}`);
      }
      data = await fallbackResponse.json();
    } else {
      data = await response.json();
    }

    // Extract generated text from response format
    let generatedText = '';
    if (data.choices && data.choices.length > 0) {
      // OpenAI-compatible format
      generatedText = data.choices[0].message?.content ?? data.choices[0].text ?? '';
    } else if (data.output) {
      generatedText = data.output;
    } else if (data.text) {
      generatedText = data.text;
    } else {
      generatedText = JSON.stringify(data);
    }

    return NextResponse.json({ response: generatedText });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}