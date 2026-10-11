import { client } from "./src/infrastructure/supabase/client.js";
import { cloudflareR2 } from "./src/infrastructure/media/r2Storage.js";

const CHAPTER_PAGES_TABLE = "chapter_pages";

/**
 * The admin UI historically performs chapter-page replacement as two calls:
 * DELETE old rows, then INSERT new rows. Intercept those two operations and
 * route the actual replacement through the database transaction function.
 * This prevents a failed insert from ever leaving a published chapter empty.
 */
function chapterPagesTable() {
  const table = client.from(CHAPTER_PAGES_TABLE);
  return new Proxy(table, {
    get(target, property, receiver) {
      if (property === 'delete') {
        return () => ({
          eq: async (column, value) => {
            if (column === 'chapter_id') return { data: null, error: null };
            return target.delete().eq(column, value);
          },
        });
      }
      if (property === 'insert') {
        return rows => {
          const list = Array.isArray(rows) ? rows : [];
          if (list.length && list.every(row => row?.chapter_id && row?.page_number != null && typeof row?.image_url === 'string')) {
            const chapterId = list[0].chapter_id;
            if (!list.every(row => row.chapter_id === chapterId)) {
              return Promise.resolve({ data: null, error: new Error('All chapter pages must belong to the same chapter.') });
            }
            return client.rpc('replace_chapter_pages', {
              p_chapter_id: chapterId,
              p_pages: list.map(row => ({ page_number: row.page_number, image_url: row.image_url })),
            });
          }
          return target.insert(rows);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function promiseCompatibleRpc(builder) {
  if (!builder || typeof builder !== 'object') return builder;
  return new Proxy(builder, {
    get(target, property) {
      if (property === 'catch') {
        return onRejected => Promise.resolve(target).catch(onRejected);
      }
      if (property === 'finally') {
        return onFinally => Promise.resolve(target).finally(onFinally);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export const supabase = new Proxy(client, {
  get(target, property) {
    if (property === 'storage') return cloudflareR2;
    if (property === 'from') return table => table === CHAPTER_PAGES_TABLE ? chapterPagesTable() : client.from(table);
    if (property === 'rpc') return (...args) => promiseCompatibleRpc(client.rpc(...args));

    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});



export {
  getPublicReaderTiers,
  getCurrentMemberships,
  getCurrentMembership,
  getCurrentlySubscribedUserIds,
  isCurrentlySubscribed,
} from "./src/features/membership/membershipService.js";

export {
  cloudflareR2,
  fetchAuthenticatedMedia,
  fetchAuthenticatedMediaBlobUrl,
} from "./src/infrastructure/media/r2Storage.js";

export { secureSignInWithPassword } from "./src/features/auth/authService.js";
