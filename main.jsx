import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import UserAuth from './UserAuth.jsx';
import ReaderBookmark from './ReaderBookmark.jsx';
import './index.css';
import './ui-polish.css';
import './admin-polish.css';
import './mihon-reader-polish.css';
import './light-mode.css';
import './admin-link-fix.css';
import './notification-fix.js';
import './reader-performance.css';
import './reader-performance.js';
import './user-auth.css';
import './user-auth-layout.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ThemeToggle />
    <UserAuth />
    <ReaderBookmark />
  </React.StrictMode>
);
