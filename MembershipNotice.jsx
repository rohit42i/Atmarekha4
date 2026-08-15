import { useEffect, useState } from 'react';

export default function MembershipNotice() {
  const [route, setRoute] = useState(window.location.hash.replace(/^#/, '') || 'home');
  useEffect(() => { const hash = () => setRoute(window.location.hash.replace(/^#/, '') || 'home'); window.addEventListener('hashchange', hash); return () => window.removeEventListener('hashchange', hash); }, []);
  return null;
}
