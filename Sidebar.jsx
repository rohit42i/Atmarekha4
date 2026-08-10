export default function Sidebar({ isOpen, onClose }) {
  return (
    <div
      className="fixed right-0 top-0 z-[2000] h-full overflow-x-hidden border-l border-zinc-800 bg-white transition-[width] duration-300 dark:border-zinc-800 dark:bg-zinc-900"
      style={{ width: isOpen ? 280 : 0 }}
    >
      <button className="absolute right-6 top-3 text-3xl text-zinc-400" onClick={onClose}>
        ×
      </button>
      <nav className="pt-20">
        {[
          ['#index', 'Home'],
          ['#about', 'About'],
          ['#latest', 'Latest Updates'],
          ['#contact', 'Contact'],
          ['#help', 'Help']
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="block px-8 py-4 text-base text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
