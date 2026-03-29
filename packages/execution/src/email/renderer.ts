/**
 * Universal Email Renderer
 *
 * Renders structured email content into HTML and plain text formats.
 * Supports both branded product emails and unbranded custom business emails.
 */

export interface EmailContent {
  subject: string;
  heading: string;
  body: string;
  intro?: string;
  details?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
  showBranding?: boolean;
  showFooter?: boolean;
  showReplyHint?: boolean;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export function renderEmail(content: EmailContent): RenderedEmail {
  return {
    html: renderHTML(content),
    text: renderText(content),
  };
}

function renderHTML(content: EmailContent): string {
  const {
    subject,
    heading,
    intro,
    body,
    details,
    ctaText,
    ctaLink,
    signatureName,
    replyHint,
    showBranding = true,
    showFooter = true,
    showReplyHint = true,
  } = content;

  const parts: string[] = [];

  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="en">');
  parts.push('<head>');
  parts.push('<meta charset="UTF-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  parts.push(`<title>${escapeHTML(subject)}</title>`);
  parts.push('</head>');
  parts.push('<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">');
  parts.push('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;padding:32px 16px;">');
  parts.push('<tr><td align="center">');
  parts.push('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">');

  parts.push('<tr><td style="padding:32px 36px 20px;border-bottom:1px solid #e4e4e7;">');
  parts.push('<h1 style="margin:0;font-size:26px;line-height:1.25;color:#18181b;font-weight:700;">');
  parts.push(escapeHTML(heading));
  parts.push('</h1>');
  parts.push('</td></tr>');

  parts.push('<tr><td style="padding:28px 36px 32px;">');

  if (intro) {
    parts.push('<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#3f3f46;">');
    parts.push(escapeHTML(intro));
    parts.push('</p>');
  }

  parts.push('<div style="font-size:16px;line-height:1.7;color:#3f3f46;">');
  parts.push(formatBodyHTML(body));
  parts.push('</div>');

  if (details) {
    parts.push('<div style="margin-top:24px;padding:18px 20px;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">');
    parts.push(formatDetailsHTML(details));
    parts.push('</div>');
  }

  if (ctaText && ctaLink) {
    parts.push('<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="background-color:#18181b;border-radius:8px;">');
    parts.push(`<a href="${escapeHTML(ctaLink)}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">`);
    parts.push(escapeHTML(ctaText));
    parts.push('</a></td></tr></table>');
  }

  if (signatureName) {
    parts.push('<p style="margin:24px 0 0;font-size:16px;line-height:1.7;color:#3f3f46;">Best regards,<br>');
    parts.push(`<strong>${escapeHTML(signatureName)}</strong>`);
    parts.push('</p>');
  }

  parts.push('</td></tr>');

  if (showFooter) {
    parts.push('<tr><td style="padding:22px 36px;background-color:#f4f4f5;border-top:1px solid #e4e4e7;">');
    parts.push('<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">');
    if (showBranding) {
      parts.push('Powered by <a href="https://execute.com" style="color:#18181b;text-decoration:underline;font-weight:600;">Execute</a> - Workflow automation');
    }
    if (showReplyHint && replyHint) {
      if (showBranding) {
        parts.push('<br><br>');
      }
      parts.push(escapeHTML(replyHint));
    }
    parts.push('</p></td></tr>');
  }

  parts.push('</table>');
  parts.push('</td></tr></table>');
  parts.push('</body></html>');

  return parts.join('');
}

function renderText(content: EmailContent): string {
  const {
    heading,
    intro,
    body,
    details,
    ctaText,
    ctaLink,
    signatureName,
    replyHint,
    showBranding = true,
    showFooter = true,
    showReplyHint = true,
  } = content;

  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push(heading.toUpperCase());
  lines.push('='.repeat(60));
  lines.push('');

  if (intro) {
    lines.push(intro);
    lines.push('');
  }

  lines.push(body);

  if (details) {
    lines.push('');
    lines.push(details);
  }

  if (ctaText && ctaLink) {
    lines.push('');
    lines.push(`${ctaText}: ${ctaLink}`);
  }

  if (signatureName) {
    lines.push('');
    lines.push('Best regards,');
    lines.push(signatureName);
  }

  if (showFooter) {
    lines.push('');
    lines.push('---');
    if (showBranding) {
      lines.push('Powered by Execute - Workflow automation');
    }
    if (showReplyHint && replyHint) {
      lines.push('');
      lines.push(replyHint);
    }
  }

  return lines.join('\n');
}

function formatBodyHTML(body: string): string {
  return body
    .split(/\n\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p style="margin:0 0 16px;">${escapeHTML(paragraph)}</p>`)
    .join('');
}

function formatDetailsHTML(details: string): string {
  return details
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#52525b;">${escapeHTMLPreservingStrong(formatted)}</p>`;
    })
    .join('');
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHTMLPreservingStrong(str: string): string {
  return escapeHTML(str)
    .replace(/&lt;strong&gt;/g, '<strong>')
    .replace(/&lt;\/strong&gt;/g, '</strong>');
}

export function validateEmailContent(content: any): { valid: boolean; error?: string } {
  if (!content.subject || typeof content.subject !== 'string') {
    return { valid: false, error: 'Email subject is required and must be a string' };
  }

  if (!content.heading || typeof content.heading !== 'string') {
    return { valid: false, error: 'Email heading is required and must be a string' };
  }

  if (!content.body || typeof content.body !== 'string') {
    return { valid: false, error: 'Email body is required and must be a string' };
  }

  if (content.intro && typeof content.intro !== 'string') {
    return { valid: false, error: 'Email intro must be a string if provided' };
  }

  if (content.details && typeof content.details !== 'string') {
    return { valid: false, error: 'Email details must be a string if provided' };
  }

  if (content.ctaText && typeof content.ctaText !== 'string') {
    return { valid: false, error: 'Email CTA text must be a string if provided' };
  }

  if (content.ctaLink && typeof content.ctaLink !== 'string') {
    return { valid: false, error: 'Email CTA link must be a string if provided' };
  }

  if (content.signatureName && typeof content.signatureName !== 'string') {
    return { valid: false, error: 'Email signature name must be a string if provided' };
  }

  if (content.replyHint && typeof content.replyHint !== 'string') {
    return { valid: false, error: 'Email reply hint must be a string if provided' };
  }

  return { valid: true };
}
