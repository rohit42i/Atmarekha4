import nodemailer from 'nodemailer';

const FROM_EMAIL = process.env.FROM_EMAIL || 'atmarekhaoffical@gmail.com';
const REPLY_TO = process.env.REPLY_TO || 'atmarekhasupport@gmail.com';
const SMTP_USER = process.env.GMAIL_SMTP_USER || FROM_EMAIL;
const APP_PASSWORD = process.env.GMAIL_SMTP_APP_PASSWORD;
const CHAPTER_NUMBER = String(process.env.CHAPTER_NUMBER || '2').trim();
const CHAPTER_URL = String(process.env.CHAPTER_URL || 'https://www.atmarekha.in/').trim();
const RECIPIENTS_RAW = String(process.env.EMAIL_TO || '').trim();
const SUBJECT = String(
  process.env.EMAIL_SUBJECT || `ATMA REKHA Chapter ${CHAPTER_NUMBER} is out!`
).trim();

if (!APP_PASSWORD) throw new Error('Missing GMAIL_SMTP_APP_PASSWORD.');
if (!RECIPIENTS_RAW) throw new Error('Missing EMAIL_TO.');

const recipients = [...new Set(
  RECIPIENTS_RAW
    .split(/[,
;]+/)
    .map(value => value.trim())
    .filter(Boolean)
)];

const validEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const invalid = recipients.filter(email => !validEmail.test(email));
if (invalid.length) {
  throw new Error(`Invalid recipient email(s): ${invalid.join(', ')}`);
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(SUBJECT)}</title>
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background:#f3f3f3;color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Chapter ${escapeHtml(CHAPTER_NUMBER)} of ATMA REKHA is live. Would love to hear what you think.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f3f3;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;">
          <tr>
            <td style="padding:40px 32px 14px;">
              <p style="margin:0 0 20px;font-size:12px;line-height:18px;letter-spacing:2px;font-weight:700;color:#111111;">ATMA REKHA</p>
              <h1 style="margin:0;font-size:30px;line-height:38px;font-weight:700;color:#111111;">ATMA REKHA Chapter ${escapeHtml(CHAPTER_NUMBER)} is out!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 12px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#111111;">Hey, what’s up?</p>
              <p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#111111;">Chapter ${escapeHtml(CHAPTER_NUMBER)} of ATMA REKHA is live.</p>
              <p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#111111;">Check it out and let me know what you think. If you enjoy it, leaving a review or comment and sharing it with a friend really helps.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 28px;">
              <a href="${escapeHtml(CHAPTER_URL)}" style="display:inline-block;padding:14px 22px;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;line-height:18px;font-weight:700;letter-spacing:.4px;">READ CHAPTER</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 36px;">
              <p style="margin:0 0 8px;font-size:15px;line-height:24px;color:#111111;">See you in the next chapter!</p>
              <p style="margin:0;font-size:15px;line-height:24px;color:#111111;">Arkesh<br>Creator of ATMA REKHA</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const text = `Hey, what’s up?

Chapter ${CHAPTER_NUMBER} of ATMA REKHA is live.

Check it out and let me know what you think. If you enjoy it, leaving a review or comment and sharing it with a friend really helps.

Read Chapter: ${CHAPTER_URL}

See you in the next chapter!

Arkesh
Creator of ATMA REKHA`;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: APP_PASSWORD,
  },
});

await transporter.verify();

for (const to of recipients) {
  const info = await transporter.sendMail({
    from: `Atma Rekha <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to,
    subject: SUBJECT,
    html,
    text,
  });
  console.log(`Sent to ${to}: ${info.messageId}`);
}

console.log(`Successfully sent ${recipients.length} email(s) from ${FROM_EMAIL}.`);
