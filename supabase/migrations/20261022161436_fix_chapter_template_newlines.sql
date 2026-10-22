-- Render the default chapter announcement as readable plain text.
UPDATE public.email_templates
SET text_body = E'Hey, hi, hello, namaste!\n\nChapter {{chapter_number}}: {{chapter_title}} is now out!\n{{chapter_description}}\n\nPlease share your review in the comments after reading.\n\nVisit Atma Rekha: {{site_url}}\n\nThank you,\nArkesh',
    updated_at = now()
WHERE slug = 'new-chapter';
