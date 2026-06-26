import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RAG AI Articles',
  description: 'Research assistant for recent journal articles',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={typeof window !== 'undefined' && window.localStorage.getItem('theme') === 'dark' ? 'dark' : ''}>
        <div className="flex min-h-screen flex-col">
          <header className="bg-white dark:bg-gray-800 p-4">
            <div className="container mx-auto flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RAG AI Articles</h1>
              <button
                id="theme-toggle"
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Toggle dark mode"
              >
                <span id="theme-icon">🌙</span>
              </button>
            </div>
          </header>
          <main className="flex-1 container mx-auto p-4">{children}</main>
        </div>
        <script src="/theme-toggle.js" defer />
      </body>
    </html>
  );
}