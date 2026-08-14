import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import UserAuth from './UserAuth.jsx';
import ProfileV2 from './ProfileV2.jsx';
import ReaderBookmark from './ReaderBookmark.jsx';
import ChapterFavorites from './ChapterFavorites.jsx';
import ReadingHistoryTracker from './ReadingHistoryTracker.jsx';
import AuthGate from './AuthGate.jsx';
import ChapterCompletionPrompt from './ChapterCompletionPrompt.jsx';
import CommunityPage from './CommunityPage.jsx';
import CommunityAdmin, { CommunityButton, CommunityMembership } from './CommunityAdmin.jsx';
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
import './chapter-completion.css';
import './engagement-fixes.css';
import './rating-modal.css';
import './community.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <CommunityButton />
    <UserAuth />
    <ProfileV2 />
    <ReaderBookmark />
    <ChapterFavorites />
    <ReadingHistoryTracker />
    <AuthGate />
    <ChapterCompletionPrompt />
    <CommunityMembership />
    <CommunityPage />
    <CommunityAdmin />
  </React.StrictMode>
);
