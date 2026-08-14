-- Atma Rekha production hardening
-- Safe changes only: pin trigger search_path, remove exact duplicate indexes,
-- and add covering indexes for existing foreign keys.

ALTER FUNCTION public.set_comments_updated_at() SET search_path = public;

DROP INDEX IF EXISTS public.bookmarks_user_chapter_key;
DROP INDEX IF EXISTS public.reading_history_user_chapter_key;
DROP INDEX IF EXISTS public.reading_history_user_chapter_uidx;
DROP INDEX IF EXISTS public.community_posts_published_at_idx;

CREATE INDEX IF NOT EXISTS bookmarks_chapter_id_idx ON public.bookmarks (chapter_id);
CREATE INDEX IF NOT EXISTS community_post_reactions_user_id_idx ON public.community_post_reactions (user_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS reading_history_chapter_id_idx ON public.reading_history (chapter_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_plan_id_idx ON public.user_subscriptions (plan_id);
