import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

(function applyInitialTheme() {
  let t = localStorage.getItem('cw-theme');
  if (t !== 'dark' && t !== 'light') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#121211' : '#F7F6F2');
})();

createRoot(document.getElementById('root')).render(<App />);
