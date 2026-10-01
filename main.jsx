import './admin-final-v5.css';
import './admin-runtime-fixes.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><AtmaLoader/><App/><UserAuth/><ReadingHistoryTracker/><AuthGate/><ChapterCompletionPrompt/><CommunityPage/><CommunityAdmin/><EnhancedComments/><PublicProfile/><FeatureUnlocks/><AdminCommandCenter/><AdminProTools/><AdminChapterHealth/><AdminGroupChatTools/><AdminManagementTools/><AdminModerationTools/><AdminOperations/><ChapterAccessGuard/><ThemeToggle/></React.StrictMode>);