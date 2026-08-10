import logoImg from '/logo.png';

export default function Footer({ isAdmin, onLogout }) {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-8 py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <a href="#index" className="flex items-center gap-3">
              <img src={logoImg} alt="Atma Rekha Logo" className="h-12 w-12 object-contain" />
              <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Atma Rekha</span>
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Discover the depths of Indian Manga. Dive into stories that resonate with culture, emotion, and creativity.
            </p>
            <div className="mt-6 flex gap-6 text-zinc-400">
              {[
                { href: 'https://www.instagram.com/atma.rekha?igsh=MzQ2YWJ3ZW42MzYx', icon: 'fab fa-instagram' },
                { href: 'https://youtube.com/@atmarekha?si=ytUOmNPrKFtxJUwn', icon: 'fab fa-youtube' },
                { href: 'https://x.com/atmarekha', icon: 'fab fa-x-twitter' },
                { href: 'mailto:itsamritanshofficial@gmail.com', icon: 'fas fa-envelope' },
              ].map(({ href, icon }) => (
                <a key={icon} href={href} target="_blank" rel="noreferrer" className="text-xl transition hover:text-zinc-900 dark:hover:text-white">
                  <i className={icon}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Discover Column */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Discover</h3>
            <ul className="mt-4 space-y-3">
              {[
                { label: 'Home', href: '#index' },
                { label: 'Start Reading', href: '#reading' },
                { label: 'Admin Login', href: '#admin' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Company</h3>
            <ul className="mt-4 space-y-3">
              {[
                { label: 'About Us', href: '#about' },
                { label: 'Contact', href: '#contact' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Column */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Account</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="#help" className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">Help Center</a>
              </li>
              {isAdmin && (
                <li>
                  <button onClick={onLogout} className="text-sm font-medium text-rose-600 transition hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300">Logout</button>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-100 pt-8 dark:border-zinc-800">
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            &copy; {new Date().getFullYear()} Atma Rekha. All rights reserved. <br className="sm:hidden" />
            <span className="opacity-70 mx-2 hidden sm:inline">|</span> Designed with passion.
            <span className="opacity-70 mx-2">|</span>
            <a href="https://www.linkedin.com/in/harsh-dubey-498498256/" target="_blank" rel="noreferrer" className="font-semibold transition hover:text-blue-600 dark:hover:text-blue-400">Developer Harsh Dubey</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
