'use client';

import { useState, useEffect } from 'react';

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'bot' | 'system';
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const userMessage: Message = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch');
      }

      const data = await response.json();
      const botMessage: Message = { id: Date.now() + 1, text: data.response, sender: 'bot' };
      setMessages(prev => [...prev, userMessage, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: 'Sorry, something went wrong.', sender: 'bot' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#3e2723] text-gray-900 dark:text-gray-100">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between bg-red-600 dark:bg-cyan-600 text-white py-4">
        <div className="flex-1 md:flex-none">
          <h1 className="text-2xl font-bold mb-2 md:mb-0">
            RAG AI Articles Assistant
            <button
              onClick={() => setDark(!dark)}
              className="ml-4 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </h1>
          <p className="text-sm opacity-90">
            Ask questions about arXiv papers from May 10-16, 2020
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`max-w-xl mx-auto p-3 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-red-600 text-white ml-auto'
                  : msg.sender === 'bot'
                  ? 'bg-white border border-gray-300 dark:bg-[#3e2723] dark:border-gray-600'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="dark:text-gray-400">
                Start a conversation by asking a question about the research papers.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-300 dark:border-gray-600">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type your question here..."
            className="flex-1 p-3 border rounded-l focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 dark:border-gray-600 dark:bg-[#3e2723] dark:text-gray-100 dark:focus:ring-cyan-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-red-600 text-white rounded-r hover:bg-red-700 disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-700"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </footer>
    </div>
  );
}