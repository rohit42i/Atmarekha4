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
