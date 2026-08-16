import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import UserAuth from './UserAuth.jsx';
import ReaderBookmark from './ReaderBookmark.jsx';
import ReadingHistoryTracker from './ReadingHistoryTracker.jsx';
import AuthGate from './AuthGate.jsx';
import ChapterCompletionPrompt from './ChapterCompletionPrompt.jsx';
import ChapterAccessGuard from './ChapterAccessGuard.jsx';
import './index.css';
import './accessibility-performance.css';
import './ui-polish.css';
import './interaction-polish.css';
import './admin-polish.css';
import './mihon-reader-polish.css';
import './admin-link-fix.css';
import './notification-fix.js';
import './reader-performance.css';
import './reader-performance.js';
import './asset-performance.js';
import './seo-runtime.js';
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
import './chapter-ui-final.css';
import './rating-upgrade.js';
import './membership.css';
import './chapter-access.css';
import './visual-polish.css';
import './theme-legacy-vars.css';
import './theme-system.js';
import './theme-system.css';
import './final-experience.css';

const CommunityPage = lazy(() => import('./CommunityPage.jsx'));
const CommunityAdmin = lazy(() => import('./CommunityAdmin.jsx'));
const EnhancedComments = lazy(() => import('./EnhancedComments.jsx'));
const PublicProfile = lazy(() => import('./PublicProfile.jsx'));
const Membership = lazy(() => import('./Membership.jsx'));

const DeferredFeatures = () => (
  <Suspense fallback={null}>
    <CommunityPage />
    <CommunityAdmin />
    <EnhancedComments />
    <PublicProfile />
    <Membership />
  </Suspense>
);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <UserAuth />
    <ReaderBookmark />
    <ReadingHistoryTracker />
    <AuthGate />
    <ChapterCompletionPrompt />
    <ChapterAccessGuard />
    <DeferredFeatures />
  </React.StrictMode>
);
