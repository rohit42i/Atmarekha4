-- Keep the default chapter-announcement subject reader-friendly and editable.
UPDATE public.email_templates
SET subject = 'Chapter {{chapter_number}} is now out!',
    updated_at = now()
WHERE slug = 'new-chapter';
