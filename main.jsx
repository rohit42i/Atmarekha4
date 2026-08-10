import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminAccess from './AdminAccess.jsx';
import './index.css';

function installFooterAdminLink() {
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const discover = headings.find((node) => node.textContent?.trim() === 'Discover');
  if (!discover) return false;

  const column = discover.parentElement;
  if (!column || column.querySelector('[data-atma-admin-link]')) return true;

  const list = column.querySelector('ul');
  if (!list) return false;

  const item = document.createElement('li');
  item.setAttribute('data-atma-admin-link', 'true');
  item.innerHTML = '<a href="#admin" class="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Admin Login</a>';
  list.appendChild(item);
  return true;
}

function Root() {
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash.split('?')[0] === '#admin');

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash.split('?')[0] === '#admin');
    };

    window.addEventListener('hashchange', handleHashChange);

    const observer = new MutationObserver(() => {
      if (installFooterAdminLink()) observer.disconnect();
    });

    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      subtree: true,
    });

    installFooterAdminLink();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      observer.disconnect();
    };
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
