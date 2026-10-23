import { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsent } from './privacyConsent.js';

export default function CookieConsent() {
  const [choice, setChoice] = useState(() => getAnalyticsConsent());

  useEffect(() => {
    const onConsentChange = event => setChoice(event.detail?.consent || getAnalyticsConsent());
    const onOpenChoices = () => setChoice(null);
    window.addEventListener('atma-analytics-consent-changed', onConsentChange);
    window.addEventListener('atma:open-privacy-choices', onOpenChoices);
    return () => {
      window.removeEventListener('atma-analytics-consent-changed', onConsentChange);
      window.removeEventListener('atma:open-privacy-choices', onOpenChoices);
    };
  }, []);

  if (choice !== null) return null;

  const choose = value => {
    setAnalyticsConsent(value);
    setChoice(value);
  };

  return <aside className="privacy-consent-banner" aria-labelledby="privacy-consent-title" role="region">
    <div className="privacy-consent-copy">
      <p className="privacy-consent-eyebrow">PRIVACY CHOICES</p>
      <h2 id="privacy-consent-title">Choose optional readership analytics</h2>
      <p>Optional analytics uses a random browser identifier to count chapter views and shares. Campaign source labels are saved only when you allow analytics. Reading, account access, and reading progress work either way.</p>
      <a href="/info/privacy">Read the privacy policy</a>
    </div>
    <div className="privacy-consent-actions">
      <button type="button" className="privacy-consent-secondary" onClick={() => choose('denied')}>Essential only</button>
      <button type="button" className="privacy-consent-primary" onClick={() => choose('granted')}>Allow analytics</button>
    </div>
  </aside>;
}
