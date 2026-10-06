create index if not exists pdlpl_bookmarks_chapter_id_idx on public.pdlpl_bookmarks(chapter_id);
create index if not exists pdlpl_chapter_ratings_chapter_id_idx on public.pdlpl_chapter_ratings(chapter_id);
create index if not exists pdlpl_comment_likes_user_id_idx on public.pdlpl_comment_likes(user_id);
create index if not exists pdlpl_comment_reports_reviewed_by_idx on public.pdlpl_comment_reports(reviewed_by);
create index if not exists pdlpl_comments_parent_comment_id_idx on public.pdlpl_comments(parent_comment_id);
create index if not exists pdlpl_comments_user_id_idx on public.pdlpl_comments(user_id);
create index if not exists pdlpl_reading_history_chapter_id_idx on public.pdlpl_reading_history(chapter_id);