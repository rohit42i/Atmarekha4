import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import UserAuth from './UserAuth.jsx';
import ReaderBookmark from './ReaderBookmark.jsx';
import ReadingHistoryTracker from './ReadingHistoryTracker.jsx';
import AuthGate from './AuthGate.jsx';
import ChapterCompletionPrompt from './ChapterCompletionPrompt.jsx';
import ChapterAccessGuard from './ChapterAccessGuard.jsx';
import { installAnalytics } from './analytics.js';
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

function DeferredFeatures() {
  const [hash, setHash] = useState(() => window.location.hash || '#home');
  useEffect(() => {
    const update = () => setHash(window.location.hash || '#home');
    window.addEventListener('hashchange', update, { passive: true });
    return () => window.removeEventListener('hashchange', update);
  }, []);

  const route = hash.toLowerCase();
  let Feature = null;
  if (route === '#community' || route.startsWith('#community/')) Feature = CommunityPage;
  else if (route === '#community-admin' || route === '#admin-community') Feature = CommunityAdmin;
  else if (route === '#profile' || route.startsWith('#profile/')) Feature = PublicProfile;
  else if (route === '#membership' || route.startsWith('#membership/')) Feature = Membership;
  else if (route === '#comments' || route.startsWith('#comments/')) Feature = EnhancedComments;

  if (!Feature) return null;
  return <Suspense fallback={null}><Feature /></Suspense>;
}

installAnalytics();

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
