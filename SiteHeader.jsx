import { useState, useEffect } from 'react';
import logoImg from '/logo.png';

export default function SiteHeader({ onToggleNav }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  useEffect(() => { const handleScroll = () => setIsScrolled(window.scrollY > 20); const handleHashChange = () => setActiveHash(window.location.hash || '#index'); window.addEventListener('scroll', handleScroll); window.addEventListener('hashchange', handleHashChange); handleHashChange(); return () => { window.removeEventListener('scroll', handleScroll); window.removeEventListener('hashchange', handleHashChange); }; }, []);
  const navLinks = [
    { href: '#index', label: 'Home' },
    { href: '#about', label: 'About' },
    { href: '#latest', label: 'Latest Updates' },
    { href: '#community', label: 'Community' },
    { href: '#contact', label: 'Contact' },
    { href: '#help', label: 'Help' },
  ];
  return <header className={`fixed inset-x-0 top-0 z-[1000] flex items-center justify-between px-8 py-4 transition-all duration-500 ${isScrolled ? 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-lg border-b border-zinc-200/50 dark:border-zinc-800/50 py-3' : 'bg-transparent border-transparent py-5'}`}><a href="#index" className="group flex items-center gap-2"><div className="relative flex h-14 w-14 items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 active:scale-95"><img src={logoImg} alt="Atma Rekha Logo" className="h-full w-full object-contain filter drop-shadow-md" /></div><div className="flex flex-col"><span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-none">Atma Rekha</span><span className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase leading-none mt-1 group-hover:text-zinc-500 transition-colors">Manga Platform</span></div></a><nav className="hidden md:flex items-center gap-1 rounded-full bg-white/50 dark:bg-zinc-900/50 p-1.5 backdrop-blur-sm border border-white/20 dark:border-zinc-800/50 shadow-sm">{navLinks.map(link => { const isActive = activeHash === link.href; return <a key={link.href} href={link.href} className={`relative px-5 py-2 text-sm font-medium transition-all duration-300 rounded-full ${isActive ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-800 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/50'}`}>{link.label}</a>; })}</nav><button onClick={onToggleNav} className="text-2xl text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white md:hidden"><i className="fas fa-bars"></i></button></header>;
}
