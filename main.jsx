import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import UserAuth from './UserAuth.jsx';
import ReaderBookmark from './ReaderBookmark.jsx';
import ReadingHistoryTracker from './ReadingHistoryTracker.jsx';
import AuthGate from './AuthGate.jsx';
import ChapterCompletionPrompt from './ChapterCompletionPrompt.jsx';
import CommunityPage from './CommunityPage.jsx';
import CommunityAdmin from './CommunityAdmin.jsx';
import EnhancedComments from './EnhancedComments.jsx';
import PublicProfile from './PublicProfile.jsx';
import Membership from './Membership.jsx';
import GroupChat, { GroupChatLauncher } from './GroupChat.jsx';
import ChapterAccessGuard from './ChapterAccessGuard.jsx';
import AtmaLoader from './AtmaLoader.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { supabase } from './supabase';
import './index.css';
import './ui-polish.css';
import './interaction-polish.css';
import './admin-polish.css';
import './admin-upgrade.css';
import './admin-overview-upgrade.css';
import './admin-dashboard-reference.css';
import './admin-dashboard-pro.css';
import './mihon-reader-polish.css';
import './admin-link-fix.css';
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
import './responsive-desktop.css';

function GroupChatGate(){
  const [unlocked,setUnlocked]=useState(false);
  useEffect(()=>{
    let active=true;
    const check=async()=>{
      const {count,error}=await supabase.from('profiles').select('id',{count:'exact',head:true});
      if(active && !error) setUnlocked((count||0)>=500);
    };
    check();
    const timer=setInterval(check,300000);
    return()=>{active=false;clearInterval(timer)};
  },[]);
  if(!unlocked) return null;
  return <><GroupChatLauncher user={true}/><GroupChat/></>;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AtmaLoader />
    <App />
    <UserAuth />
    <ReaderBookmark />
    <ReadingHistoryTracker />
    <AuthGate />
    <ChapterCompletionPrompt />
    <CommunityPage />
    <CommunityAdmin />
    <EnhancedComments />
    <PublicProfile />
    <Membership />
    <GroupChatGate />
    <ChapterAccessGuard />
    <ThemeToggle />
  </React.StrictMode>
);