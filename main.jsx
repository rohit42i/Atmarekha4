import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminAccess from './AdminAccess.jsx';
import './index.css';

function Root() {
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash.split('?')[0] === '#admin');

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash.split('?')[0] === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      <App />
      {isAdminRoute && (
        <AdminAccess onClose={() => { window.location.hash = '#index'; }} />
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
