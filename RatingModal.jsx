export default function RatingModal({ isOpen, currentRating, onSetRating, onSubmit }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80">
      <div className="w-[320px] rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Rate Story</h3>
        <div className="my-6 text-3xl text-zinc-300">
          {[1, 2, 3, 4, 5].map((n) => (
            <i
              key={n}
              className={`fa-solid fa-star cursor-pointer transition ${currentRating >= n ? 'text-yellow-400' : 'text-zinc-300'}`}
              onClick={() => onSetRating(n)}
            ></i>
          ))}
        </div>
        <button onClick={onSubmit} className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black shadow-md">
          SUBMIT
        </button>
      </div>
    </div>
  );
}
