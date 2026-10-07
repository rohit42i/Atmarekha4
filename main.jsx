import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import SiteRuntime from './SiteRuntime.jsx';
import { installGlobalErrorLogging } from './errorLogger.js';
import UserAuth from './UserAuth.jsx';
import ReadingHistoryTracker from './ReadingHistoryTracker.jsx';
import AuthGate from './AuthGate.jsx';
import ChapterCompletionPrompt from './ChapterCompletionPrompt.jsx';
const CommunityPage = lazy(() => import('./CommunityPage.jsx'));
const CommunityAdmin = lazy(() => import('./CommunityAdmin.jsx'));
const EnhancedComments = lazy(() => import('./EnhancedComments.jsx'));
const PublicProfile = lazy(() => import('./PublicProfile.jsx'));
import FeatureUnlocks from './FeatureUnlocks.jsx';
const AdminGroupChatTools = lazy(() => import('./AdminGroupChatTools.jsx'));
const AdminModerationTools = lazy(() => import('./AdminModerationTools.jsx'));
const AdminManagementTools = lazy(() => import('./AdminManagementTools.jsx'));
const AdminProTools = lazy(() => import('./AdminProTools.jsx'));
const AdminChapterHealth = lazy(() => import('./AdminChapterHealth.jsx'));
const AdminOperations = lazy(() => import('./AdminOperations.jsx'));
import ChapterAccessGuard from './ChapterAccessGuard.jsx';
import AtmaLoader from './AtmaLoader.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import ExperienceEnhancements from './ExperienceEnhancements.jsx';
import './index.css';
import './ui-polish.css';
import './interaction-polish.css';
import './mihon-reader-polish.css';
import './notification-fix.js';
import './notification-prompt.js';
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
import './group-chat.css';
import './group-chat-feed-fix.css';
import './enhanced-comments.css';
import './public-profile.css';
import './premium-typography.css';
import './final-polish.css';
import './chapter-ui-final.css';
import './membership.css';
import './chapter-access.css';
import './visual-polish.css';
import './theme-legacy-vars.css';
import './theme-system.js';
import './theme-system.css';
import './final-experience.css';
import './responsive-desktop.css';
import './InfoPage.css';
import './micro-polish.css';
import './ui-refinement.css';
import './final-touch.css';
import './content-moderation.js';
import './membership-fullscreen-fix.css';
import './comments-mobile-header-fix.css';
import './pal-do-pal-ke-lamhe.css';
import './reader-theme-surface-fix.css';
import './dark-mode-text-final.css';
import './light-mode-81225-restore.css';
import './light-mode-shadow-cleanup.css';
import './typography-text-system.css';
import './error-feedback.css';

installGlobalErrorLogging();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AtmaLoader/>
    <App/>
    <UserAuth/>
    <ReadingHistoryTracker/>
    <AuthGate/>
    <ChapterCompletionPrompt/>
    <FeatureUnlocks/>
    <ChapterAccessGuard/>
    <ThemeToggle/>
    <ExperienceEnhancements/>
      <Suspense fallback={null}>
      <CommunityPage/>
      <CommunityAdmin/>
      <EnhancedComments/>
      <PublicProfile/>
      <AdminProTools/>
      <AdminChapterHealth/>
      <AdminGroupChatTools/>
      <AdminManagementTools/>
      <AdminModerationTools/>
      <AdminOperations/>
      </Suspense>
      <SiteRuntime/>
    </ErrorBoundary>
  </React.StrictMode>
);


import './experience-enhancements.css';
import './membership-pro.css';
import './audience-experience.css';
import './admin-studio-tokens.css';
import './admin-studio-core.css';
import './ui-layout-audit.css';
import './production-theme-authority.css';
