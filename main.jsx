import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import UserAuth from './UserAuth.jsx';
import ReaderBookmark from './ReaderBookmark.jsx';
import ChapterFavorites from './ChapterFavorites.jsx';
import ReadingHistoryTracker from './ReadingHistoryTracker.jsx';
import AuthGate from './AuthGate.jsx';
import ChapterCompletionPrompt from './ChapterCompletionPrompt.jsx';
import CommunityPage from './CommunityPage.jsx';
import CommunityAdmin from './CommunityAdmin.jsx';
import EnhancedComments from './EnhancedComments.jsx';
import PublicProfile from './PublicProfile.jsx';
import './index.css';
import './ui-polish.css';
import './interaction-polish.css';
import './admin-polish.css';
import './mihon-reader-polish.css';
import './admin-link-fix.css';
import './notification-fix.js';
import './reader-performance.css';
import './reader-performance.js';
import './user-auth.css';
import './user-auth-layout.css';
import './profile-v2.css';
import './auth-gate.css';
import './auth-gate-pro.css';
import './chapter-completion.css';
import './engagement-fixes.css';
import './rating-modal.css';
import './rating-upgrade.css';
import './community.css';
import './enhanced-comments.css';
import './public-profile.css';
import './premium-typography.css';
import './final-polish.css';
import './appearance-polish.css';
import './chapter-original-layout.css';
import './rating-upgrade.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <UserAuth />
    <ReaderBookmark />
    <ChapterFavorites />
    <ReadingHistoryTracker />
    <AuthGate />
    <ChapterCompletionPrompt />
    <CommunityPage />
    <CommunityAdmin />
    <EnhancedComments />
    <PublicProfile />
  </React.StrictMode>
);
