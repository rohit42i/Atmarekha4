-- Chapter page replacement requires authenticated admin authorization inside the function.
revoke execute on function public.replace_chapter_pages(uuid, jsonb) from anon;
