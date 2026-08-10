export default function FabPlay({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl text-black shadow-lg transition hover:scale-105 dark:bg-white"
    >
      <i className="fa-solid fa-play"></i>
    </button>
  );
}
