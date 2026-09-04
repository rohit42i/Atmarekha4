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
import AdminGroupChatTools from './AdminGroupChatTools.jsx';
import AdminModerationTools from './AdminModerationTools.jsx';
import AdminManagementTools from './AdminManagementTools.jsx';
import AdminCommandCenter from './AdminCommandCenter.jsx';
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
import './reader-swipe-fix.js';
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
import './rating-upgrade.js';
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
import './admin-final-system.css';
import './admin-dark-upgrade.css';
import './admin-studio-tokens.css';
import './admin-ultimate-ui.css';
import './admin-productivity.js';
import './membership-fullscreen-fix.css';
import './font-polish.css';
import './comments-mobile-header-fix.css';
import './admin-studio-pro-v2.css';

function GroupChatLauncherGate(){
  const [user,setUser]=useState(null);
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const [{data:sessionData},{count,error}]=await Promise.all([
        supabase.auth.getSession(),
        supabase.from('profiles').select('id',{count:'exact',head:true})
      ]);
      if(!active)return;
      setUser(sessionData?.session?.user||null);
      setEnabled(!error&&Number(count||0)>=500);
    };
    load();
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active)setUser(session?.session?.user||session?.user||null);
    });
    const channel=supabase.channel('group-chat-user-threshold')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'profiles'},()=>{load()})
      .subscribe();
    return()=>{
      active=false;
      listener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  },[]);
  if(!enabled)return null;
  return <><GroupChatLauncher user={user}/><GroupChat/></>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AtmaLoader/><App/><UserAuth/><ReaderBookmark/><ReadingHistoryTracker/><AuthGate/><ChapterCompletionPrompt/><CommunityPage/><CommunityAdmin/><EnhancedComments/><PublicProfile/><Membership/><GroupChatLauncherGate/><AdminCommandCenter/><AdminGroupChatTools/><AdminManagementTools/><AdminModerationTools/><ChapterAccessGuard/><ThemeToggle/></React.StrictMode>);