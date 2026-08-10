export default function ComingSoonModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70">
      <div className="w-[420px] max-w-[90%] rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-white">Coming Soon</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          We're working hard to bring the publishing feature to you soon. Stay tuned!
        </p>
        <button onClick={onClose} className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black shadow-md">
          Close
        </button>
      </div>
    </div>
  );
}
