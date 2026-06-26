// theme-toggle.js
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  // Check for saved user preference or use system preference
  const getPreferredTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Set theme on the document
  const setTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      themeIcon.textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark');
      themeIcon.textContent = '🌙';
    }
    localStorage.setItem('theme', theme);
  };

  // Initialize theme
  const initialTheme = getPreferredTheme();
  setTheme(initialTheme);

  // Toggle theme when button is clicked
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    setTheme(currentTheme);
  });
});