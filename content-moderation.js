const PROFANITY_TERMS = [
  'fuck','fucking','fucker','fuckhead','fuckface','shit','shitting','shitter','shithead','bitch','bitches','bitchass','bastard','asshole','dick','dickhead','pussy','cunt','slut','whore','motherfucker','cock','cocksucker','douchebag','prick','twat','wanker','dipshit','jackass','bullshit','dumbass','nigger','faggot','retard','crap','piss','hoe','arsehole','bugger','clit','cockhead','goddamn','motherfuckers','bastards','dumbfuck','asswipe','cumslut','jizz','slutty','blowjob',
  'chutiya','chutiye','madarchod','maderchod','behenchod','bhenchod','bhosdike','bhosdi','gaand','gandu','randi','raand','harami','kutta','kuttiya','saala','saale','kamina','kamine','lauda','loda','chut','jhant','suar','bhosda','gandmasti','laund','laundiya','bakchod','bakchodi','hijra','chutiyapa','mc','bc','bsdk','bhosadike','harambhor','kamini','chutian','gaanddu','madarchodh','bhosdika','lodu','chutiyap','randiwe','haramzada','haramzadi','gandoo','jhantu','bhosada','randiya','saali','bhenkeode','chutmarani','gaandfat','gaandmora','kutti','chuth','tattu','chodna',
  'kanjar','kanjra','khasma','khasmakhania','fittehmu','fittehmoo','dalle','dalla','pentechoda','chawal','kuttapan','pencho','penchod',
  'aaizavli','aaizavadya','zavli','zavadya','bhadva','bhadvya','bullya','yedzhava','yedzhavya','gandit','chutya','lavda',
  'bokachoda','khanki','bal','khankirmag','chudmarani','gandmarani','magirchele','chodna','pod','podmarani','chodis','shor',
  'pundai','otha','ootha','pundamavane','thevadiya','thevadiyamavan','sunni','poolu','koothi','mayiru','munda','somberi','lucu','loosie','punda',
  'dhengey','dengey','lanja','lanjakodaka','pooku','puku','modda','gudha','sanka','lanjamunda','modagudhu','munde','maddalo',
  'soole','soolemaga','kullamari','munde','bolli','bollimaga',
  'myre','myru','patti','thendi','pooran','poori','vadamavane','pulayadi',
  'chutiyam','suvar','ghando','luppad'
];

const escaped = PROFANITY_TERMS.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const profanityRegex = new RegExp(`(?:^|[^a-z0-9])(?:${escaped.join('|')})(?=$|[^a-z0-9])`, 'i');
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findProfanity(value) {
  const text = normalize(value);
  if (!text || !profanityRegex.test(text)) return [];
  const found = [];
  for (const term of PROFANITY_TERMS) {
    const re = new RegExp(`(?:^| )${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$| )`, 'g');
    const matches = text.match(re);
    if (matches?.length) found.push({ term, count: matches.length });
  }
  return found;
}

function markElement(element) {
  if (!element || element.dataset.arModerated === '1') return;
  const matches = findProfanity(element.textContent);
  if (!matches.length) return;
  const article = element.closest('.group-message, .ec-comment');
  const avatar = article?.querySelector('.group-avatar, .ec-avatar, .ec-avatar-button .ec-avatar');
  const total = matches.reduce((sum, item) => sum + item.count, 0);
  element.dataset.arModerated = '1';
  element.dataset.arModerationCount = String(total);
  element.classList.add('ar-profanity-blur');
  element.setAttribute('title', 'Message blurred by community moderation');
  if (avatar) {
    avatar.classList.add('ar-profanity-flag', total >= 3 ? 'ar-profanity-red' : 'ar-profanity-yellow');
    avatar.setAttribute('title', 'Community moderation flag · 24h');
  }
  if (article) article.classList.add('ar-has-profanity');
}

function scan(root = document) {
  root.querySelectorAll?.('.group-bubble, .ec-content').forEach(markElement);
}

const style = document.createElement('style');
style.textContent = `
.ar-profanity-blur{filter:blur(5px);transition:filter .18s ease;cursor:pointer;user-select:none}
.ar-profanity-blur:hover,.ar-profanity-blur:focus{filter:blur(2px)}
.ar-profanity-flag{box-shadow:0 0 0 2px #e0b84a,0 0 0 4px rgba(224,184,74,.14)!important}
.ar-profanity-red{box-shadow:0 0 0 2px #d94b4b,0 0 0 4px rgba(217,75,75,.18)!important}
.ar-profanity-yellow{box-shadow:0 0 0 2px #e0b84a,0 0 0 4px rgba(224,184,74,.14)!important}
.ar-has-profanity .ec-meta:after{content:'FLAGGED';font:700 8px/1 Inter,system-ui,sans-serif;color:#e0b84a;margin-left:6px;letter-spacing:.08em}
.ar-has-profanity .ec-meta:has(.ar-profanity-red):after{color:#d94b4b}
`;
document.head.appendChild(style);

scan();
const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) scan(node);
    });
  }
});
observer.observe(document.body, { childList: true, subtree: true });
