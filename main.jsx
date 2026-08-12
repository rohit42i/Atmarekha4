import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import './index.css';
import './ui-polish.css';
import './admin-polish.css';
import './mihon-reader-polish.css';
import './light-mode.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ThemeToggle />
  </React.StrictMode>
);
