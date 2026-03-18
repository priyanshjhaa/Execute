/**
 * Universal Email Renderer
 *
 * Renders structured email content into branded HTML and plain text formats.
 * All Execute emails use a consistent, professional layout.
 */

export interface EmailContent {
  // Required fields
  subject: string;
  heading: string;
  body: string;

  // Optional fields
  intro?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;

  // Presentation flags (default: true for backward compatibility)
  showBranding?: boolean;
  showFooter?: boolean;
  showReplyHint?: boolean;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/**
 * Render structured email content into both HTML and plain text formats
 */
export function renderEmail(content: EmailContent): RenderedEmail {
  return {
    html: renderHTML(content),
    text: renderText(content),
  };
}

/**
 * Render HTML version with branded Execute styling
 */
function renderHTML(content: EmailContent): string {
  const {
    heading,
    intro,
    body,
    ctaText,
    ctaLink,
    signatureName,
    replyHint,
    showBranding = true,
    showFooter = true,
    showReplyHint = true,
  } = content;

  // Build the HTML email
  const parts: string[] = [];

  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="en">');
  parts.push('<head>');
  parts.push('<meta charset="UTF-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  parts.push('<title>Email from Execute</title>');
  parts.push('</head>');
  parts.push('<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f4f4f5;">');

  // Email container
  parts.push('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f5; padding: 40px 20px;">');
  parts.push('<tr>');
  parts.push('<td align="center">');

  // Email wrapper
  parts.push('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">');

  // Header
  parts.push('<tr>');
  parts.push('<td style="padding: 32px 40px 24px; border-bottom: 1px solid #e4e4e7;">');
  parts.push('<h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b; line-height: 1.3;">');
  parts.push(escapeHTML(heading));
  parts.push('</h1>');
  parts.push('</td>');
  parts.push('</tr>');

  // Content area
  parts.push('<tr>');
  parts.push('<td style="padding: 32px 40px;">');

  // Intro (optional)
  if (intro) {
    parts.push('<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">');
    parts.push(escapeHTML(intro));
    parts.push('</p>');
  }

  // Body (required)
  parts.push('<div style="font-size: 16px; line-height: 1.6; color: #3f3f46;">');
  parts.push(formatBodyHTML(body));
  parts.push('</div>');

  // CTA button (optional - only if both text and link are provided)
  if (ctaText && ctaLink) {
    parts.push('<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">');
    parts.push('<tr>');
    parts.push('<td style="background-color: #000000; border-radius: 6px;">');
    parts.push('<a href="' + escapeHTML(ctaLink) + '" style="display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: 500; color: #ffffff; text-decoration: none;">');
    parts.push(escapeHTML(ctaText));
    parts.push('</a>');
    parts.push('</td>');
    parts.push('</tr>');
    parts.push('</table>');
  }

  // Signature (optional)
  if (signatureName) {
    parts.push('<p style="margin: 24px 0 0 0; font-size: 16px; line-height: 1.6; color: #3f3f46;">');
    parts.push('Best regards,<br>');
    parts.push('<strong>' + escapeHTML(signatureName) + '</strong>');
    parts.push('</p>');
  }

  parts.push('</td>');
  parts.push('</tr>');

  // Footer (optional)
  if (showFooter) {
    parts.push('<tr>');
    parts.push('<td style="padding: 24px 40px; background-color: #f4f4f5; border-top: 1px solid #e4e4e7;">');
    parts.push('<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #71717a;">');

    // Branding (optional)
    if (showBranding) {
      parts.push('Powered by <a href="https://execute.com" style="color: #000000; text-decoration: underline; font-weight: 500;">Execute</a> – Workflow automation');
    }

    // Reply hint (optional, only if showReplyHint is true)
    if (showReplyHint && replyHint) {
      if (showBranding) {
        parts.push('<br><br>');
      }
      parts.push(escapeHTML(replyHint));
    }

    parts.push('</p>');
    parts.push('</td>');
    parts.push('</tr>');
  }

  parts.push('</table>'); // End email wrapper
  parts.push('</td>');
  parts.push('</tr>');
  parts.push('</table>'); // End container

  parts.push('</body>');
  parts.push('</html>');

  return parts.join('');
}

/**
 * Render plain text version
 */
function renderText(content: EmailContent): string {
  const {
    heading,
    intro,
    body,
    ctaText,
    ctaLink,
    signatureName,
    replyHint,
    showBranding = true,
    showFooter = true,
    showReplyHint = true,
  } = content;

  const lines: string[] = [];

  // Heading
  lines.push('='.repeat(60));
  lines.push(heading.toUpperCase());
  lines.push('='.repeat(60));
  lines.push('');

  // Intro (optional)
  if (intro) {
    lines.push(intro);
    lines.push('');
  }

  // Body (required)
  lines.push(body);
  lines.push('');

  // CTA (optional)
  if (ctaText && ctaLink) {
    lines.push(`${ctaText}: ${ctaLink}`);
    lines.push('');
  }

  // Signature (optional)
  if (signatureName) {
    lines.push('Best regards,');
    lines.push(signatureName);
    lines.push('');
  }

  // Footer (optional)
  if (showFooter) {
    lines.push('---');
    if (showBranding) {
      lines.push('Powered by Execute - Workflow automation');
    }

    // Reply hint (optional, only if showReplyHint is true)
    if (showReplyHint && replyHint) {
      lines.push('');
      lines.push(replyHint);
    }
  }

  return lines.join('\n');
}

/**
 * Format body content - convert newlines to paragraphs
 */
function formatBodyHTML(body: string): string {
  // Split by double newlines to separate paragraphs
  const paragraphs = body.split(/\n\n+/);

  return paragraphs
    .map(para => {
      // Escape HTML first
      const escaped = escapeHTML(para);
      // Wrap in paragraph tag
      return `<p style="margin: 0 0 16px;">${escaped}</p>`;
    })
    .join('');
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate required fields in email content
 */
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

  // Validate optional fields if present
  if (content.intro && typeof content.intro !== 'string') {
    return { valid: false, error: 'Email intro must be a string if provided' };
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
