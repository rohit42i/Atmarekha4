import FeedbackForm from './FeedbackForm.jsx';

const INSTAGRAM_URL = 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const PAGES = {
  about: {
    eyebrow: 'ATMA REKHA',
    title: 'About Atma Rekha',
    details: [
      ['Creator', 'Arkesh'], ['Language', 'Roman Hindi'],
      ['New chapters', 'Planned for the 14th of each month'],
      ['Format', 'Digital manga'], ['Free chapters', '1 to 8'],
      ['Age guidance', '15+'], ['Team', 'Independent creator'],
    ],
    story: [
      'I’m Arkesh, the solo creator of Atma Rekha, an original Indian fantasy adventure manga about people, traditions, and powers connected by a mystery that slowly unfolds. The story follows its characters and the choices they make, with more of the world revealed as their journey continues.',
      'I create the series independently and publish it first in Roman Hindi. New chapters are planned for the 14th of each month, though the schedule can shift when a chapter needs more work.',
      'Every scene and panel begins with my own rough drawings and design decisions. I determine the composition, pose, camera angle, perspective, proportions, shapes, and character placement. I use AI tools in parts of the visual process to enhance my rough sketches and help develop characters while following my original designs and direction.',
      'AI generated material is not used directly as finished artwork in the published manga. When AI-assisted imagery is used as a background reference, I manually outline and redraw it as part of the artwork. I retain creative control over the story, character designs, panel composition, and final artistic decisions, and review the pages before publication.',
    ],
  },
  contact: {
    eyebrow: 'CONTACT', title: 'Contact',
    sections: [
      { heading: 'Email', body: 'Have a question or need help with your account or membership? Send us an email.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }] },
      { heading: 'Instagram', body: 'Follow Atma Rekha for updates and previews.', links: [{ label: '@atma.rekha', href: INSTAGRAM_URL }] },
    ],
  },
  report: {
    eyebrow: 'REPORT', title: 'Report a problem',
    sections: [
      { heading: 'Complaints and support', body: 'For a broken page, comment, account, membership or privacy issue, email us. Grievance Officer: Arkesh, creator. Consumer complaints are acknowledged within 48 hours and addressed within one month where applicable. Never send passwords, OTPs, UPI PINs or full card details.', links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}?subject=Atma%20Rekha%20Support` }] },
    ],
  },
  terms: {
    eyebrow: 'TERMS', title: 'Terms of use',
    sections: [
      { heading: 'Using the site', body: 'Atma Rekha is for reading manga and using its reader and community features. Please use the site lawfully and respectfully. Do not harass others, post illegal or harmful material, impersonate people, share private information, spam, or interfere with the site. We may hide content or restrict accounts when needed to protect readers or the service.' },
      { heading: 'Stories and artwork', body: 'The story, characters, writing, branding and creative material made for Atma Rekha are provided for reading here. You may share links to the site, but do not copy, repost, sell or reuse the pages and materials without permission.' },
      { heading: 'Membership and payments', body: 'Before joining, check the price, billing frequency and chapter access shown on the membership page. Membership renews automatically when that is part of the plan you choose. You can cancel to stop future renewals, and access for the paid period follows the terms shown when you joined. For an incorrect payment or missing access, contact us with the payment or subscription reference. Refund requests are reviewed under applicable law and the transaction details. Never send passwords, OTPs, UPI PINs, CVVs or full card details to support.' },
      { heading: 'Changes and contact', body: 'Chapters, release plans and features may change, and the site may occasionally be unavailable. We may update these terms when needed. Nothing here takes away rights that cannot legally be excluded. For account, membership or other complaints, contact ' + CONTACT_EMAIL + '.' },
    ],
  },

};


const HINDI = {
  'About Atma Rekha':'आत्मा रेखा के बारे में',
  'An independent Indian fantasy adventure manga created by Arkesh.':'आर्केश द्वारा बनाई गई एक स्वतंत्र भारतीय फैंटेसी एडवेंचर मंगा।',
  'Creator':'निर्माता','Language':'भाषा','Roman Hindi':'रोमन हिंदी','New chapters':'नए अध्याय',
  'Planned for the 14th of each month':'हर महीने की 14 तारीख को प्रकाशित करने की योजना',
  'Format':'प्रारूप','Digital manga':'डिजिटल मंगा','Free chapters':'मुफ़्त अध्याय','1 to 8':'1 से 8',
  'Age guidance':'आयु सुझाव','Team':'टीम','Independent creator':'स्वतंत्र निर्माता',
  'Contact':'संपर्क करें','Questions or need a hand? Get in touch.':'कोई सवाल है या मदद चाहिए? हमसे संपर्क करें।',
  'Email':'ईमेल','Have a question or need help with your account or membership? Send us an email.':'खाते या सदस्यता में मदद चाहिए? हमें ईमेल भेजें।',
  'Instagram':'इंस्टाग्राम','Follow Atma Rekha for updates and previews.':'अपडेट और झलकियों के लिए आत्मा रेखा को फ़ॉलो करें।',
  'Report a problem':'समस्या की रिपोर्ट करें','Let us know if something needs our attention.':'किसी समस्या पर हमारा ध्यान दिलाएँ।',
  'Complaints and support':'शिकायत और सहायता',
  'For a broken page, comment, account, membership or privacy issue, email us. Grievance Officer: Arkesh, creator. Consumer complaints are acknowledged within 48 hours and addressed within one month where applicable. Never send passwords, OTPs, UPI PINs or full card details.':'वेबसाइट, टिप्पणी, खाते, सदस्यता या गोपनीयता की समस्या हो तो हमें ईमेल करें। शिकायत अधिकारी: आर्केश, निर्माता। जहाँ लागू हो, उपभोक्ता शिकायतों की प्राप्ति 48 घंटों में स्वीकार की जाएगी और एक महीने के भीतर समाधान किया जाएगा। पासवर्ड, OTP, UPI PIN या कार्ड की पूरी जानकारी कभी न भेजें।',
  'Terms of use':'उपयोग की शर्तें','A few simple rules for using the site.':'वेबसाइट इस्तेमाल करने के कुछ सरल नियम।',
  'Using the site':'वेबसाइट का उपयोग',
  'Atma Rekha is for reading manga and using its reader and community features. Please use the site lawfully and respectfully. Do not harass others, post illegal or harmful material, impersonate people, share private information, spam, or interfere with the site. We may hide content or restrict accounts when needed to protect readers or the service.':'आत्मा रेखा मंगा पढ़ने और समुदाय सुविधाओं के लिए है। वेबसाइट का कानूनी और सम्मानजनक उपयोग करें। दूसरों को परेशान न करें, गैरकानूनी या हानिकारक सामग्री पोस्ट न करें, किसी की पहचान न अपनाएँ, निजी जानकारी साझा न करें, स्पैम न करें और वेबसाइट के काम में बाधा न डालें। पाठकों या सेवा की सुरक्षा के लिए हम सामग्री छिपा सकते हैं या खातों पर प्रतिबंध लगा सकते हैं।',
  'Stories and artwork':'कहानी और कलाकृति',
  'The story, characters, writing, branding and creative material made for Atma Rekha are provided for reading here. You may share links to the site, but do not copy, repost, sell or reuse the pages and materials without permission.':'आत्मा रेखा की कहानी, पात्र, लेखन, ब्रांडिंग और रचनात्मक सामग्री यहाँ पढ़ने के लिए उपलब्ध हैं। वेबसाइट के लिंक साझा कर सकते हैं, लेकिन अनुमति के बिना पन्नों या सामग्री की नकल, दोबारा पोस्ट, बिक्री या पुनः उपयोग न करें।',
  'Membership and payments':'सदस्यता और भुगतान',
  'Before joining, check the price, billing frequency and chapter access shown on the membership page. Membership renews automatically when that is part of the plan you choose. You can cancel to stop future renewals, and access for the paid period follows the terms shown when you joined. For an incorrect payment or missing access, contact us with the payment or subscription reference. Refund requests are reviewed under applicable law and the transaction details. Never send passwords, OTPs, UPI PINs, CVVs or full card details to support.':'सदस्य बनने से पहले सदस्यता पेज पर कीमत, बिलिंग अवधि और अध्यायों की पहुँच जाँच लें। आपके प्लान में शामिल होने पर सदस्यता अपने-आप नवीनीकृत हो सकती है। भविष्य के नवीनीकरण रोकने के लिए रद्द करें। गलत भुगतान या पहुँच न मिलने पर भुगतान संदर्भ के साथ हमसे संपर्क करें। रिफंड अनुरोधों की समीक्षा लागू कानून और लेन-देन के विवरण के अनुसार होगी। पासवर्ड, OTP, UPI PIN, CVV या कार्ड की पूरी जानकारी कभी न भेजें।',
  'Changes and contact':'बदलाव और संपर्क',
  'Chapters, release plans and features may change, and the site may occasionally be unavailable. We may update these terms when needed. Nothing here takes away rights that cannot legally be excluded. For account, membership or other complaints, contact atmarekhasupport@gmail.com.':'अध्याय, प्रकाशन योजनाएँ और सुविधाएँ बदल सकती हैं और कभी-कभी वेबसाइट उपलब्ध नहीं हो सकती। ज़रूरत पड़ने पर हम इन शर्तों को अपडेट कर सकते हैं। यहाँ लिखी कोई बात कानूनन सुरक्षित अधिकारों को समाप्त नहीं करती। खाते, सदस्यता या शिकायतों के लिए atmarekhasupport@gmail.com पर संपर्क करें।',
  'Back':'वापस'
,
  'I’m Arkesh, the solo creator of Atma Rekha, an original Indian fantasy adventure manga about people, traditions, and powers connected by a mystery that slowly unfolds. The story follows its characters and the choices they make, with more of the world revealed as their journey continues.':'मैं आर्केश हूँ, आत्मा रेखा का एकल निर्माता। यह एक मौलिक भारतीय फैंटेसी एडवेंचर मंगा है, जिसमें लोग, परंपराएँ और शक्तियाँ धीरे-धीरे खुलने वाले रहस्य से जुड़ी हैं। कहानी पात्रों और उनके फैसलों का अनुसरण करती है; उनकी यात्रा आगे बढ़ने के साथ दुनिया के और पहलू सामने आते हैं।',
  'I create the series independently and publish it first in Roman Hindi. New chapters are planned for the 14th of each month, though the schedule can shift when a chapter needs more work.':'मैं इस श्रृंखला को स्वतंत्र रूप से बनाता हूँ और इसे पहले रोमन हिंदी में प्रकाशित करता हूँ। नए अध्याय हर महीने की 14 तारीख को प्रकाशित करने की योजना है, हालाँकि किसी अध्याय पर अतिरिक्त काम होने पर समय बदल सकता है।',
  'Every scene and panel begins with my own rough drawings and design decisions. I determine the composition, pose, camera angle, perspective, proportions, shapes, and character placement. I use AI tools in parts of the visual process to enhance my rough sketches and help develop characters while following my original designs and direction.':'हर दृश्य और पैनल की शुरुआत मेरे अपने शुरुआती रेखाचित्रों और डिज़ाइन संबंधी फैसलों से होती है। रचना, मुद्रा, कैमरा कोण, परिप्रेक्ष्य, अनुपात, आकार और पात्रों की जगह मैं तय करता हूँ। दृश्य प्रक्रिया के कुछ हिस्सों में मैं अपने मूल डिज़ाइन और दिशा के अनुसार शुरुआती रेखाचित्रों को बेहतर बनाने और पात्र विकसित करने के लिए AI टूल इस्तेमाल करता हूँ।',
  'AI generated material is not used directly as finished artwork in the published manga. When AI-assisted imagery is used as a background reference, I manually outline and redraw it as part of the artwork. I retain creative control over the story, character designs, panel composition, and final artistic decisions, and review the pages before publication.':'प्रकाशित मंगा में AI से बनी सामग्री को सीधे अंतिम कलाकृति के रूप में इस्तेमाल नहीं किया जाता। जब AI-सहायता वाली छवि को पृष्ठभूमि संदर्भ के रूप में लिया जाता है, तो मैं कलाकृति के हिस्से के रूप में उसकी रूपरेखा हाथ से बनाता और उसे दोबारा ड्रॉ करता हूँ। कहानी, पात्रों के डिज़ाइन, पैनल की रचना और अंतिम कलात्मक फैसलों पर मेरा रचनात्मक नियंत्रण रहता है, और प्रकाशन से पहले मैं पन्नों की समीक्षा करता हूँ।',
};

function localized(value, language) { return language === 'hi' ? (HINDI[value] || value) : value; }

function Section({ heading, body, links = [], language = 'en' }) {
  return <article className="info-section"><h3>{localized(heading, language)}</h3><p>{localized(body, language)}</p>{links.length > 0 && <div className="info-links">{links.map(link => <a key={link.href} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined}>{link.label} ↗</a>)}</div>}</article>;
}

export default function InfoPage({ type, onBack }) {
  const [language, setLanguage] = useState('en');
  const page = PAGES[type] || PAGES.about;
  const isAbout = type === 'about';
  const t = value => localized(value, language);
  return <main className="info-page" lang={language === "hi" ? "hi-IN" : "en-IN"}>
    <header className="subpage-header info-page-header">
      <button className="back-button" onClick={onBack} aria-label={t("Back")}>←</button>
      <div><p className="header-kicker">{t(page.eyebrow)}</p><h1>{t(page.title)}</h1></div><div className="info-language-switch" role="group" aria-label="Language"><button type="button" aria-pressed={language === "en"} className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button><button type="button" aria-pressed={language === "hi"} className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिन्दी</button></div>
    </header>
    <section className="info-card info-hero">
      <h2>{t(page.title)}</h2>
      <p className="info-hero-copy">{t(isAbout ? 'An independent Indian fantasy adventure manga created by Arkesh.' : type === 'contact' ? 'Questions or need a hand? Get in touch.' : type === 'terms' ? 'A few simple rules for using the site.' : 'Let us know if something needs our attention.')}</p>
    </section>
    {isAbout ? <section className="info-card info-content-card" aria-label="About Atma Rekha">
      <div className="about-details">{page.details.map(([label, value]) => <div className="about-detail" key={label}><strong>{t(label)}:</strong><span>{t(value)}</span></div>)}</div>
      <div className="about-story">{page.story.map((paragraph, index) => <p key={index}>{t(paragraph)}</p>)}</div>
    </section> : <section className="info-card info-content-card">
      <div className="info-sections">{page.sections.map(section => <Section key={section.heading} {...section} language={language}/>)}</div>
      {type === 'report' && <div className="info-feedback-card"><FeedbackForm/></div>}
    </section>}
  </main>;
}
