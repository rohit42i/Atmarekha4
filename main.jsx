import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import './index.css';
import './ui-polish.css';
import './admin-polish.css';
import './mihon-reader-polish.css';
import './light-mode.css';
import './admin-link-fix.css';
import './notification-fix.js';
import './reader-performance.css';
import './reader-performance.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ThemeToggle />
  </React.StrictMode>
);
