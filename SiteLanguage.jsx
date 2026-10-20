import { useEffect, useState } from 'react';
import './site-language.css';

const DICTIONARY = {
  'Start Reading': 'Padhna Shuru Karein',
  'View Chapters': 'Chapters Dekhein',
  'Chapter List': 'Chapters Ki Suchi',
  'Chapters': 'Chapters',
  'Continue Reading': 'Padhna Jaari Rakhein',
  'Continue reading': 'Padhna jaari rakhein',
  'Recently read': 'Haal Hi Mein Padhe',
  'Recent chapters': 'Naye Chapters',
  'New chapters': 'Naye Chapters',
  'Chapter details unavailable': 'Chapter ki jaankari uplabdh nahi hai',
  'Chapter not found.': 'Chapter nahi mila.',
  'Back to chapters': 'Chapters par vaapas jaayein',
  'Back to Home': 'Home par vaapas jaayein',
  'Back to home': 'Home par vaapas jaayein',
  'Back': 'Vaapas',
  'Retry': 'Dobara koshish karein',
  'Loading Atma Rekha…': 'Atma Rekha load ho raha hai…',
  'Opening chapter…': 'Chapter khul raha hai…',
  'Loading comments…': 'Comments load ho rahe hain…',
  'Comments': 'Comments',
  'Comments unavailable': 'Comments uplabdh nahi hain',
  'No comments yet': 'Abhi tak koi comment nahi hai',
  'Be the first reader to share a thought.': 'Apni baat kehne wale pehle reader banein.',
  'Join the conversation': 'Baatcheet mein shaamil hon',
  'Replying to a reader': 'Reader ko reply kar rahe hain',
  'Reply': 'Reply dein',
  'Cancel': 'Radd karein',
  'Report': 'Report karein',
  'Reported': 'Report kiya gaya',
  'Post reply': 'Reply post karein',
  'Post comment': 'Comment post karein',
  'Posting…': 'Post ho raha hai…',
  'What did you think?': 'Aapko kaisa laga?',
  'Write a reply…': 'Reply likhein…',
  'Rate chapter': 'Chapter ko rate karein',
  'Rate': 'Rate karein',
  'Choose rating from 1 to 10': '1 se 10 tak rating chunein',
  'Close': 'Band karein',
  'Close comments': 'Comments band karein',
  'You already rated this chapter on this device.': 'Aap is device par is chapter ko pehle hi rate kar chuke hain.',
  'Thank you.': 'Shukriya.',
  'Sign in to rate this chapter.': 'Chapter rate karne ke liye sign in karein.',
  'Sign in to post a comment.': 'Comment karne ke liye sign in karein.',
  'Sign in to like comments.': 'Comment like karne ke liye sign in karein.',
  'Unable to save rating.': 'Rating save nahi ho saki.',
  'Unable to load comments.': 'Comments load nahi ho sake.',
  'Unable to post comment.': 'Comment post nahi ho saka.',
  'Community': 'Community',
  'Creator updates and messages from the Atma Rekha community.': 'Atma Rekha community ke updates aur messages.',
  'Group Chat': 'Group Chat',
  'Talk with the Atma Rekha community.': 'Atma Rekha community ke saath baat karein.',
  'About': 'Parichay',
  'About Atma Rekha': 'Atma Rekha ke baare mein',
  'Contact': 'Sampark',
  'Report': 'Report karein',
  'Privacy': 'Privacy',
  'Privacy Policy': 'Privacy Policy',
  'Terms': 'Shartein',
  'Terms of use': 'Istemaal ki shartein',
  'Terms and Conditions': 'Niyam aur shartein',
  'More & Settings': 'Aur Settings',
  'PROFILE': 'PROFILE',
  'Membership, community, security and useful features for your Atma Rekha experience.': 'Atma Rekha ke liye membership, community, security aur zaroori features.',
  'Membership': 'Membership',
  'Security': 'Security',
  'Notification preferences': 'Notification ki pasand',
  'Notifications': 'Notifications',
  'Install the app': 'App install karein',
  'Install app': 'App install karein',
  'Refresh page': 'Page refresh karein',
  'Back to profile': 'Profile par vaapas jaayein',
  'Sign in': 'Sign in karein',
  'Sign up': 'Account banayein',
  'Create account': 'Account banayein',
  'Log in': 'Login karein',
  'Log out': 'Logout karein',
  'Sign out': 'Sign out karein',
  'Email': 'Email',
  'Email / Gmail': 'Email / Gmail',
  'Password': 'Password',
  'Confirm password': 'Password confirm karein',
  'Forgot password?': 'Password bhool gaye?',
  'Reset password': 'Password reset karein',
  'Name is required.': 'Naam zaroori hai.',
  'Password is required.': 'Password zaroori hai.',
  'Passwords do not match.': 'Passwords match nahi karte.',
  'Please correct the highlighted fields.': 'Highlight kiye gaye fields theek karein.',
  'Display name': 'Display name',
  'Username': 'Username',
  'Bio': 'Bio',
  'Tell readers a little about yourself': 'Apne baare mein readers ko thoda batayein',
  'Save changes': 'Badlaav save karein',
  'Save profile': 'Profile save karein',
  'Profile saved.': 'Profile save ho gayi.',
  'Edit profile': 'Profile edit karein',
  'Cancel': 'Radd karein',
  'Reader': 'Reader',
  'Recently': 'Haal hi mein',
  'More & Settings': 'Aur Settings',
  'Home': 'Home',
  'Search chapters': 'Chapters search karein',
  'Search': 'Search karein',
  'Search chapters…': 'Chapters search karein…',
  'Sort by': 'Is hisaab se sort karein',
  'Latest': 'Sabse naye',
  'Oldest': 'Sabse purane',
  'All': 'Sabhi',
  'Filter': 'Filter karein',
  'No chapters found.': 'Koi chapter nahi mila.',
  'No chapters available yet.': 'Abhi koi chapter uplabdh nahi hai.',
  'Work in Progress': 'Kaam jaari hai',
  'SIDE STORY · SCHOOL LIFE': 'SIDE STORY · SCHOOL LIFE',
  'Starts April 25, 2027': '25 April 2027 se shuru',
  'View Chapters →': 'Chapters dekhein →',
  'New chapters are planned for the 14th of each month': 'Naye chapters har mahine ki 14 tareekh ko aane ki yojana hai',
  'Free chapters': 'Free chapters',
  'Creator': 'Creator',
  'Language': 'Bhasha',
  'Format': 'Format',
  'Age guidance': 'Umar sambandhi salah',
  'Team': 'Team',
  'Independent creator': 'Independent creator',
  'Digital manga': 'Digital manga',
  'Roman Hindi': 'Roman Hindi',
  'Contact Atma Rekha': 'Atma Rekha se sampark karein',
  'Contact the Atma Rekha team for support, feedback, or general enquiries.': 'Support, feedback ya kisi sawaal ke liye Atma Rekha team se sampark karein.',
  'Report a problem': 'Samasya report karein',
  'Report Atma Rekha Content': 'Atma Rekha content report karein',
  'Complaints and support': 'Shikayat aur support',
  'Using the site': 'Website ka istemaal',
  'Stories and artwork': 'Kahaniyan aur artwork',
  'Membership and payments': 'Membership aur payments',
  'Changes and contact': 'Badlaav aur sampark',
  'Your privacy choices': 'Aapki privacy ki pasand',
  'Privacy controls': 'Privacy controls',
  'Export data': 'Data export karein',
  'Correct profile': 'Profile ki jaankari sudhaarein',
  'Withdraw consent': 'Consent vaapas lein',
  'Deletion request': 'Deletion request',
  'Deletion request in progress': 'Deletion request par kaam jaari hai',
  'A request is already being reviewed': 'Ek request pehle se review ho rahi hai',
  'No consent record is available': 'Consent ka record uplabdh nahi hai',
  'Reader customization': 'Reader customization',
  'Adjust the page background and manga image fit.': 'Page ka background aur manga image fit badlein.',
  'New chapters': 'Naye chapters',
  'When a new chapter is published.': 'Naya chapter publish hone par.',
  'Comments and replies': 'Comments aur replies',
  'Replies to your comments and relevant comment activity.': 'Aapke comments ke replies aur sambandhit activity.',
  'New group chat messages and activity.': 'Group chat ke naye messages aur activity.',
  'New posts and updates from the community.': 'Community ke naye posts aur updates.',
  'Important creator updates and site announcements.': 'Creator ke zaroori updates aur website announcements.',
  'Membership and account': 'Membership aur account',
  'Membership, security and account-related updates.': 'Membership, security aur account se jude updates.',
  'Other creator updates': 'Creator ke doosre updates',
  'Other updates you choose to receive.': 'Aapke chune hue doosre updates.',
  'Save preferences': 'Pasand save karein',
  'Preferences saved.': 'Pasand save ho gayi.',
  'Could not load your saved choices. Refresh the page and try again. Your saved settings were not changed.': 'Aapki saved pasand load nahi ho saki. Page refresh karke dobara koshish karein. Aapki settings nahi badli gayi hain.',
  'Unable to confirm your sign-in status. Refresh the page and try again.': 'Sign-in status confirm nahi ho saka. Page refresh karke dobara koshish karein.',
  'Admin Panel': 'Admin Panel',
  'Admin Login': 'Admin Login',
  'Access Denied': 'Access Denied',
  "You don't have permission to access the Atma Rekha Admin Panel.": 'Aapko Atma Rekha Admin Panel kholne ki permission nahi hai.',
  'Back to Home': 'Home par vaapas jaayein',
  'No account yet?': 'Abhi account nahi hai?',
  'Already have an account?': 'Pehle se account hai?',
  'Continue with Google': 'Google se jaari rakhein',
  'OR': 'YA',
  'Loading…': 'Load ho raha hai…',
  'Saving…': 'Save ho raha hai…',
  'Please sign in again.': 'Dobara sign in karein.',
  'Read the first 8 chapters. Membership is not required yet.': 'Pehle 8 chapters padhein. Abhi membership zaroori nahi hai.',
  'Keep reading from Chapter 9 and support the main story.': 'Chapter 9 se padhna jaari rakhein aur main story ko support karein.',
  'Read both stories with one membership.': 'Ek membership ke saath dono stories padhein.',
  'Full access to both stories.': 'Dono stories ka poora access.',
  'Read Chapters 1–8': 'Chapters 1–8 padhein',
  'Save reading progress': 'Reading progress save karein',
  'Bookmark chapters': 'Chapters bookmark karein',
  'Rate & comment': 'Rate aur comment karein',
  'Atma Rekha Chapter 9+': 'Atma Rekha Chapter 9+',
  'Every Atma Rekha chapter': 'Atma Rekha ke sabhi chapters',
  'Every PDPKL chapter': 'PDPKL ke sabhi chapters',
  'Supporter badge': 'Supporter badge',
  'Premium Supporter badge': 'Premium Supporter badge',
  'Super Supporter badge': 'Super Supporter badge',
  'Monthly membership': 'Monthly membership',
  'Cancel anytime': 'Kabhi bhi cancel karein',
  'Priority comments': 'Priority comments',
  'Choose a membership': 'Membership chunein',
  'Subscribe': 'Subscribe karein',
  'Buy membership': 'Membership khareedein',
  'Current plan': 'Maujooda plan',
  'Active membership': 'Active membership',
  'Manage membership': 'Membership manage karein',
  'Cancel membership': 'Membership cancel karein',
  'Payment successful': 'Payment safal raha',
  'Payment failed': 'Payment fail hua',
  'Try again': 'Dobara koshish karein',
  'Community posts': 'Community posts',
  'Create post': 'Post banayein',
  'Write a post…': 'Post likhein…',
  'Post': 'Post karein',
  'Like': 'Like karein',
  'Share': 'Share karein',
  'Copy': 'Copy karein',
  'Message copied.': 'Message copy ho gaya.',
  'Could not copy this message.': 'Yeh message copy nahi ho saka.',
  'Sign in to react.': 'React karne ke liye sign in karein.',
  'No posts yet.': 'Abhi koi post nahi hai.',
  'Notifications': 'Notifications',
  'Enable notifications': 'Notifications on karein',
  'Disable notifications': 'Notifications off karein',
  'Language': 'Bhasha',
  'English': 'English',
  'Hindi': 'Hindi',
  'Roman Hindi': 'Roman Hindi',
  'Chapters read': 'Padhe gaye chapters',
  'Saved chapters': 'Save kiye gaye chapters',
  'Reading history': 'Reading history',
  'Bookmarks': 'Bookmarks',
  'Favourites': 'Pasandida',
  'Favorites': 'Pasandida',
  'Remove from favourites': 'Pasandida se hataayein',
  'Add to favourites': 'Pasandida mein jodein',
  'Sign in to add to favourites': 'Pasandida mein jodne ke liye sign in karein',
  'Change profile picture': 'Profile picture badlein',
  'your_handle': 'aapka_username',
  'Save Changes': 'Badlaav save karein',
  'Save changes': 'Badlaav save karein',
  'Add a short bio so your profile feels like yours.': 'Apni profile ko apna banane ke liye chhota sa bio jodein.',
  'Discard your unsaved profile changes?': 'Kya aap bina save kiye profile ke badlaav hataana chahte hain?',
  'That username is already taken.': 'Yeh username pehle se liya gaya hai.',
  'Your profile details were saved, but the email change failed:': 'Profile details save ho gayi, lekin email badalna fail hua:',
  'Check your Gmail': 'Apna Gmail check karein',
  'Create your account': 'Apna account banayein',
  'Reset your password': 'Apna password reset karein',
  'Welcome back': 'Vaapas aane par swagat hai',
  'Enter your email and we’ll send you a secure reset link.': 'Apna email daalein; hum secure reset link bhejenge.',
  'A confirmation email has been sent to your Gmail. Open it and verify your email address, then return here.': 'Aapke Gmail par confirmation email bheja gaya hai. Email kholkar address verify karein, phir yahan vaapas aayein.',
  'Please wait…': 'Kripya intezaar karein…',
  'Send reset link': 'Reset link bhejein',
  'Back to sign in': 'Sign in par vaapas jaayein',
  'New to Atma Rekha?': 'Atma Rekha par naye hain?',
  'Create account': 'Account banayein',
  'Hide password': 'Password chhupayein',
  'Show password': 'Password dikhayein',
  'Name': 'Naam',
  'Confirm password': 'Password confirm karein',
  'Please accept the privacy notice to create an account.': 'Account banane ke liye privacy notice sweekar karein.',
  'Account creation is limited to readers aged 15 and over.': 'Account sirf 15 saal ya usse zyada umar ke readers bana sakte hain.',
  'Loading privacy controls…': 'Privacy controls load ho rahe hain…',
  'This page explains what information Atma Rekha uses, why it is needed, and the choices you have.': 'Is page par bataya gaya hai ki Atma Rekha kaunsi jaankari istemaal karta hai, kyun karta hai aur aapke paas kya options hain.',
  'Last updated: 19 October 2026': 'Aakhri update: 19 October 2026',
  'YOUR CONTROLS': 'AAPKE CONTROLS',
  'Manage your privacy': 'Apni privacy manage karein',
  'Download available account data': 'Uplabdh account data download karein',
  'Review and update profile details': 'Profile details dekhein aur update karein',
  'Consent withdrawn': 'Consent vaapas liya gaya',
  'Email a privacy request': 'Privacy request email karein',
  'REQUEST STATUS': 'REQUEST KA STATUS',
  'Your recent privacy request': 'Aapki haal ki privacy request',
  'Manage your personal data': 'Apna personal data manage karein',
  'Sign in to access available privacy controls. You can also email us about a privacy request without signing in.': 'Privacy controls ke liye sign in karein. Bina sign in kiye bhi privacy request email kar sakte hain.',
  'Back home': 'Home par vaapas jaayein',
  'For a privacy question or request, email': 'Privacy ke sawaal ya request ke liye email karein',
  'Community': 'Community',
  'Sign in to react.': 'React karne ke liye sign in karein.',
  'Message copied.': 'Message copy ho gaya.',
  'Could not copy this message.': 'Message copy nahi ho saka.',
  'just now': 'abhi',
  'No chapters found': 'Koi chapter nahi mila',
  'Try a chapter number or title.': 'Chapter number ya title se search karein.',
  'You’ve reached the end.': 'Aap list ke aakhir tak pahunch gaye hain.',
  'End of chapter list': 'Chapter list ka aakhir',
  'Untitled chapter': 'Bina title ka chapter',
  'Newest first': 'Naye pehle',
  'Oldest first': 'Purane pehle',
  'Chapter': 'Chapter',
  'Special': 'Special',
  'Sort': 'Sort karein',
  'Language': 'Bhasha',
  'Page': 'Page',
  'Previous page': 'Pichhla page',
  'Next page': 'Agla page',
  'Previous ch': 'Pichhla chapter',
  'Next ch': 'Agla chapter',
  'No previous chapter': 'Pichhla chapter nahi hai',
  'No next chapter': 'Agla chapter nahi hai',
  'Share': 'Share karein',
  'Open comments': 'Comments kholein',
  'Remove from favourites': 'Pasandida se hataayein',
  'Add to favourites': 'Pasandida mein jodein',
  'Members only': 'Sirf members ke liye',
  'Members': 'Members',
  'Your membership does not include PDPKL.': 'Aapki membership mein PDPKL shamil nahi hai.',
  'Chapter 1 onward · Members only': 'Chapter 1 se aage · Sirf members ke liye',
  '₹29 Premium Supporter': '₹29 Premium Supporter',
  '₹49 Super Supporter': '₹49 Super Supporter',
  'Maybe later': 'Baad mein',
  '₹19 Supporter does not include Pal Do Pal Ke Lamhe.': '₹19 Supporter mein Pal Do Pal Ke Lamhe shamil nahi hai.',
  'PDPKL membership required': 'PDPKL membership zaroori hai',
  'Page unavailable.': 'Page uplabdh nahi hai.',
  'Loading page…': 'Page load ho raha hai…',
  'Page': 'Page',
  'PAGE': 'PAGE',
  'Reader profile': 'Reader profile',
  'Continue reading': 'Padhna jaari rakhein',
  'No notifications yet': 'Abhi notifications nahi hain',
  'Mark all as read': 'Sabko read mark karein',
  'Delete account': 'Account delete karein',
  'Change email': 'Email badlein',
  'Verify email': 'Email verify karein',
  'Two-step verification': 'Two-step verification',
  'Authenticator app': 'Authenticator app',
  'Enable two-step verification': 'Two-step verification on karein',
  'Disable two-step verification': 'Two-step verification off karein',
  'Confirm': 'Confirm karein',
  'Continue': 'Jaari rakhein',
  'Done': 'Ho gaya',
  'Status': 'Status',
  'Pending': 'Pending',
  'Active': 'Active',
  'Expired': 'Expire ho gaya',
  'Unavailable': 'Uplabdh nahi',
  'Something went wrong. Please try again.': 'Kuch galat hua. Dobara koshish karein.',
  'Changes saved.': 'Badlaav save ho gaye.',
  'No results found.': 'Koi result nahi mila.',
  'Clear chapter search': 'Chapter search saaf karein',
  'Chapter navigation': 'Chapter navigation',
  'Profile avatar': 'Profile avatar',
  'Tell readers a little about yourself': 'Readers ko apne baare mein thoda batayein',
  'Sign in to continue': 'Jaari rakhne ke liye sign in karein',
  'You are signed out.': 'Aap sign out ho chuke hain.',
  'Read & Share': 'Padhein aur share karein',
  'The story follows its characters and the choices they make, with more of the world revealed as their journey continues.': 'Kahani apne kirdaaron aur unke faislon ke saath aage badhti hai; unke safar mein duniya ke aur raaz saamne aate hain.',
  'Planned for the 14th of each month': 'Har mahine ki 14 tareekh ko aane ki yojana hai',
  'An independent Indian fantasy adventure manga created by Arkesh.': 'Arkesh ki banayi hui ek independent Bharatiya fantasy adventure manga.',
  'I’m Arkesh, the solo creator of Atma Rekha, an original Indian fantasy adventure manga about people, traditions, and powers connected by a mystery that slowly unfolds. The story follows its characters and the choices they make, with more of the world revealed as their journey continues.': 'Main Arkesh hoon, Atma Rekha ka solo creator. Yeh ek original Bharatiya fantasy adventure manga hai jahan log, paramparayein aur shaktiyan dheere-dheere khulte rahasya se judi hain. Kahani kirdaaron aur unke faislon ke saath aage badhti hai aur safar mein duniya ke aur raaz saamne aate hain.',
  'I create the series independently and publish it first in Roman Hindi. New chapters are planned for the 14th of each month, though the schedule can shift when a chapter needs more work.': 'Main yeh series independently banata hoon aur sabse pehle Roman Hindi mein publish karta hoon. Naye chapters har mahine ki 14 tareekh ko aane ki yojana hai, lekin chapter par aur kaam hone par schedule badal sakta hai.',
  'Every scene and panel begins with my own rough drawings and design decisions. I determine the composition, pose, camera angle, perspective, proportions, shapes, and character placement. I use AI tools in parts of the visual process to enhance my rough sketches and help develop characters while following my original designs and direction.': 'Har scene aur panel ki shuruaat mere rough drawings aur design decisions se hoti hai. Composition, pose, camera angle, perspective, proportions, shapes aur character placement main tay karta hoon. Visual process ke kuch hisson mein AI tools rough sketches ko behtar banane aur mere original designs ke mutabik characters develop karne mein madad karte hain.',
  'AI generated material is not used directly as finished artwork in the published manga. When AI-assisted imagery is used as a background reference, I manually outline and redraw it as part of the artwork. I retain creative control over the story, character designs, panel composition, and final artistic decisions, and review the pages before publication.': 'AI-generated material ko published manga mein seedha final artwork ke roop mein istemaal nahi kiya jata. AI-assisted imagery ko background reference ke roop mein use karne par main use manually outline aur redraw karta hoon. Story, character designs, panel composition aur final artistic decisions par mera creative control rehta hai, aur publication se pehle main pages review karta hoon.',
  'Have a question or need help with your account or membership? Send us an email.': 'Koi sawaal hai ya account/membership mein madad chahiye? Humein email karein.',
  'Follow Atma Rekha for updates and previews.': 'Updates aur previews ke liye Atma Rekha ko follow karein.',
  'For a broken page, comment, account, membership or privacy issue, email us. Grievance Officer: Arkesh, creator. Consumer complaints are acknowledged within 48 hours and addressed within one month where applicable. Never send passwords, OTPs, UPI PINs or full card details.': 'Page, comment, account, membership ya privacy ki samasya ke liye humein email karein. Grievance Officer: Arkesh, creator. Consumer complaints ka acknowledgement 48 ghanton mein diya jata hai aur jahan lagu ho, ek mahine ke andar address kiya jata hai. Password, OTP, UPI PIN ya card ki poori details kabhi na bhejein.',
  'Atma Rekha is for reading manga and using its reader and community features. Please use the site lawfully and respectfully. Do not harass others, post illegal or harmful material, impersonate people, share private information, spam, or interfere with the site. We may hide content or restrict accounts when needed to protect readers or the service.': 'Atma Rekha manga padhne aur reader/community features istemaal karne ke liye hai. Website ka istemaal kanooni aur sammanjanak tareeke se karein. Kisi ko pareshan na karein, gair-kanooni ya nuksaan pahunchane wala content post na karein, kisi ki nakal na karein, private jaankari share na karein, spam na karein aur website mein rukawat na daalein. Readers ya service ki suraksha ke liye zaroorat padne par content hide ya account restrict kiya ja sakta hai.',
  'The story, characters, writing, branding and creative material made for Atma Rekha are provided for reading here. You may share links to the site, but do not copy, repost, sell or reuse the pages and materials without permission.': 'Atma Rekha ki story, characters, writing, branding aur creative material yahan padhne ke liye diya gaya hai. Aap website ke links share kar sakte hain, lekin permission ke bina pages ya material copy, repost, sell ya reuse na karein.',
  'Before joining, check the price, billing frequency and chapter access shown on the membership page. Membership renews automatically when that is part of the plan you choose. You can cancel to stop future renewals, and access for the paid period follows the terms shown when you joined. For an incorrect payment or missing access, contact us with the payment or subscription reference. Refund requests are reviewed under applicable law and the transaction details. Never send passwords, OTPs, UPI PINs, CVVs or full card details to support.': 'Membership lene se pehle price, billing frequency aur chapter access check karein. Chune gaye plan mein auto-renewal ho to membership apne aap renew hogi. Agle renewals rokne ke liye cancel kar sakte hain; paid period ka access sign-up ke waqt dikhayi gayi sharton ke mutabik rahega. Galat payment ya access na milne par payment/subscription reference ke saath sampark karein. Refund requests lagu kanoon aur transaction details ke hisaab se review ki jaati hain. Support ko password, OTP, UPI PIN, CVV ya card ki poori details kabhi na bhejein.',
  'Chapters, release plans and features may change, and the site may occasionally be unavailable. We may update these terms when needed. Nothing here takes away rights that cannot legally be excluded. For account, membership or other complaints, contact atmarekhasupport@gmail.com.': 'Chapters, release plans aur features badal sakte hain aur website kabhi-kabhi unavailable ho sakti hai. Zaroorat par hum in sharton ko update kar sakte hain. Yahan likhi koi baat un adhikaron ko khatam nahi karti jinhe kanoonan nahi hataya ja sakta. Account, membership ya doosri shikayat ke liye atmarekhasupport@gmail.com par sampark karein.',
  'Ques': 'Sawaal',
  'Sign in to continue': 'Jaari rakhne ke liye sign in karein',
};

const ATTRIBUTE_DICTIONARY = {
  'Search chapters': 'Chapters search karein',
  'Search chapters…': 'Chapters search karein…',
  'Tell readers a little about yourself': 'Apne baare mein readers ko thoda batayein',
  'What did you think?': 'Aapko kaisa laga?',
  'Write a reply…': 'Reply likhein…',
  'Back to profile': 'Profile par vaapas jaayein',
  'Back to home': 'Home par vaapas jaayein',
  'Close': 'Band karein',
  'Refresh page': 'Page refresh karein',
  'Email': 'Email',
  'Password': 'Password',
};

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const originalTextNodes = new WeakMap();
const lastTranslatedTextNodes = new WeakMap();

function SiteLanguageTranslator({ language }) {
  useEffect(() => {
    const originals = originalTextNodes;
    const lastTranslated = lastTranslatedTextNodes;
    const attributes = ['placeholder', 'aria-label', 'title', 'alt'];
    const translateNode = node => {
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,textarea,input,select,option,[data-i18n-ignore]')) return;
      const current = node.nodeValue || '';
      const previousTranslated = lastTranslated.get(node);
      if (previousTranslated !== undefined && current !== previousTranslated) originals.set(node, current);
      if (!originals.has(node)) originals.set(node, current);
      const original = originals.get(node);
      const key = normalize(original);
      const translated = language === 'hi' ? DICTIONARY[key] : undefined;
      const next = translated ? (original.match(/^\s*/)?.[0] || '') + translated + (original.match(/\s*$/)?.[0] || '') : original;
      if (current !== next) {
        node.nodeValue = next;
        lastTranslated.set(node, next);
      } else if (translated) lastTranslated.set(node, next);
    };
    const translateAttributes = element => {
      if (!(element instanceof Element) || element.closest('[data-i18n-ignore]')) return;
      for (const attribute of attributes) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        if (element.getAttribute('data-atma-i18n-original-' + attribute) === null) {
          element.setAttribute('data-atma-i18n-original-' + attribute, current);
        }
        const original = element.getAttribute('data-atma-i18n-original-' + attribute) ?? current;
        const next = language === 'hi' ? (ATTRIBUTE_DICTIONARY[normalize(original)] || DICTIONARY[normalize(original)] || original) : original;
        if (current !== next) element.setAttribute(attribute, next);
      }
    };
    const process = root => {
      if (root.nodeType === Node.TEXT_NODE) translateNode(root);
      else if (root.nodeType === Node.ELEMENT_NODE) {
        translateAttributes(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) translateNode(node);
        root.querySelectorAll?.('*').forEach(translateAttributes);
      }
    };
    process(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateNode(record.target);
        for (const node of record.addedNodes || []) process(node);
        if (record.type === 'attributes' && record.target instanceof Element) translateAttributes(record.target);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    document.documentElement.lang = language === 'en' ? 'en-IN' : 'hi-Latn-IN';
    return () => observer.disconnect();
  }, [language]);
  return null;
}

export default function SiteLanguage() {
  const [language, setLanguage] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLanguage = params.get('lang');
      if (urlLanguage === 'en' || urlLanguage === 'hi') return urlLanguage;
      return window.localStorage.getItem('atma-language') === 'en' ? 'en' : 'hi';
    } catch { return 'hi'; }
  });

  useEffect(() => {
    const sync = event => {
      const next = event?.detail?.language;
      if (next === 'en' || next === 'hi') setLanguage(next);
    };
    window.addEventListener('atma:site-language-change', sync);
    return () => window.removeEventListener('atma:site-language-change', sync);
  }, []);

  const choose = next => {
    if (next !== 'en' && next !== 'hi') return;
    setLanguage(next);
    try { window.localStorage.setItem('atma-language', next); } catch {}
    window.dispatchEvent(new CustomEvent('atma:site-language-change', { detail: { language: next } }));
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') {
      const url = next === 'en' ? '/?lang=en' : '/';
      if (window.location.pathname + window.location.search !== url) window.history.replaceState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (path.replace(/\/+$/, '') === '/chapters') {
      const url = next === 'en' ? '/chapters?lang=en' : '/chapters';
      if (window.location.pathname + window.location.search !== url) window.history.replaceState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return <>
    <SiteLanguageTranslator language={language} />
    <div className="site-language-switch" role="group" aria-label="Website language">
      <span className="site-language-label">{language === 'en' ? 'Language' : 'Bhasha'}</span>
      <button type="button" className={language === 'en' ? 'is-active' : ''} aria-pressed={language === 'en'} onClick={() => choose('en')}>EN</button>
      <button type="button" className={language === 'hi' ? 'is-active' : ''} aria-pressed={language === 'hi'} onClick={() => choose('hi')}>HI</button>
    </div>
  </>;
}
