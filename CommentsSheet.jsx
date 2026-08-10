export default function CommentsSheet({ isOpen, activeChapter, comments, inputValue, onInputChange, nameValue, onNameChange, onSubmit, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1900] bg-black/80" onClick={onClose}></div>
      <div className="fixed bottom-0 left-0 right-0 z-[2000] h-[72vh] rounded-t-3xl border-t-4 border-white/40 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Comments: {activeChapter}</h3>
          <button className="text-xl text-zinc-400" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="mb-4 h-[45vh] overflow-y-auto space-y-3">
          {(comments || []).map((comment, idx) => {
            // Handle both old string format (fallback) and new object format
            const isObject = typeof comment === 'object' && comment !== null;
            const name = isObject ? comment.name : 'User';
            const text = isObject ? comment.text : comment;

            return (
              <div
                key={`${activeChapter}-${idx}`}
                className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <b className="mb-0.5 block text-xs text-blue-600 dark:text-blue-400">{name}</b>
                <p>{text}</p>
              </div>
            );
          })}
          {(!comments || comments.length === 0) && (
            <p className="text-center text-zinc-500 py-10">No comments yet.</p>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="mb-3">
            <input
              value={nameValue}
              onChange={onNameChange}
              placeholder="Your Name (Optional)"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              value={inputValue}
              onChange={onInputChange}
              placeholder="Add a comment..."
              className="flex-1 rounded-full border border-zinc-200 bg-zinc-100 px-5 py-3 text-sm text-zinc-800 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            />
            <button
              onClick={onSubmit}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg text-white shadow-md hover:bg-blue-700 transition"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
