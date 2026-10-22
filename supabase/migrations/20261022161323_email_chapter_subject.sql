-- Keep the default chapter-announcement subject and message reader-friendly.
-- Atma Rekha announcement emails link to the homepage, not chapter-specific URLs.
UPDATE public.email_templates
SET category = 'updates',
    subject = 'Chapter {{chapter_number}} is now out!',
    html_body = '<p>Hey, hi, hello, namaste!</p><p><strong>Chapter {{chapter_number}}: {{chapter_title}}</strong> is now out!</p><p>{{chapter_description}}</p><p>Please share your review in the comments after reading.</p><p><a href="{{site_url}}">Visit Atma Rekha</a></p><p>Thank you,<br>Arkesh</p>',
    text_body = 'Hey, hi, hello, namaste!\n\nChapter {{chapter_number}}: {{chapter_title}} is now out!\n{{chapter_description}}\n\nPlease share your review in the comments after reading.\n\nVisit Atma Rekha: {{site_url}}\n\nThank you,\nArkesh',
    updated_at = now()
WHERE slug = 'new-chapter';
