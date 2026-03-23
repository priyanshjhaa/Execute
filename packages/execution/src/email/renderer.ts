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
  details?: string; // Structured details box for smart templates
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
  urgency?: 'low' | 'medium' | 'high' | 'urgent'; // For smart templates

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
    details,
    ctaText,
    ctaLink,
    signatureName,
    replyHint,
    urgency,
    showBranding = true,
    showFooter = true,
    showReplyHint = true,
  } = content;

  // Build the HTML email using clean, modern template
  const parts: string[] = [];

  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="en">');
  parts.push('<head>');
  parts.push('<meta charset="UTF-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  parts.push('<title>Email from Execute</title>');
  parts.push('</head>');
  parts.push('<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f9f9f9;">');

  // Main container with padding
  parts.push('<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9f9f9;">');

  // Email card
  parts.push('<div style="background: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #eee;">');

  // Header
  parts.push('<h2 style="margin-bottom: 10px;">');
  parts.push(escapeHTML(heading));
  parts.push('</h2>');

  // Intro (optional)
  if (intro) {
    parts.push('<p style="color: #555; font-size: 14px;">');
    parts.push(escapeHTML(intro));
    parts.push('</p>');
  }

  // Body content
  parts.push('<p style="font-size: 14px; color: #555;">');
  parts.push(escapeHTML(body));
  parts.push('</p>');

  // Details box (for smart templates)
  if (details) {
    parts.push('<div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">');
    parts.push(formatDetailsHTML(details));
    parts.push('</div>');
  }

  // Closing paragraph
  if (!details) {
    parts.push('<p style="font-size: 14px; color: #555;">');
    parts.push('Please make sure to complete this as soon as possible.');
    parts.push('</p>');
  }

  // CTA button
  if (ctaText && ctaLink) {
    parts.push('<a href="' + escapeHTML(ctaLink) + '" ');
    parts.push('style="display: inline-block; margin-top: 20px; padding: 12px 20px; background: black; color: white; text-decoration: none; border-radius: 6px;">');
    parts.push(escapeHTML(ctaText));
    parts.push('</a>');
  }

  parts.push('</div>'); // End email card

  // Footer
  if (showFooter) {
    parts.push('<p style="text-align: center; font-size: 12px; color: #999; margin-top: 15px;">');

    if (showBranding) {
      parts.push('Powered by <strong>Execute</strong> — Turn instructions into actions');
    }

    if (showReplyHint && replyHint) {
      if (showBranding) {
        parts.push('<br>');
      }
      parts.push(escapeHTML(replyHint));
    }

    parts.push('</p>');
  }

  parts.push('</div>'); // End main container

  return parts.join('');
}

/**
 * Format details box for smart templates
 * Handles markdown-style bold and newlines
 */
function formatDetailsHTML(details: string): string {
  const lines = details.split('\n');
  return lines.map(line => {
    const escaped = escapeHTML(line);
    // Check if it's a bold line (**key: value** format)
    if (line.match(/^\*\*.*\*\*:|^.*:/)) {
      return `<p style="margin: 5px 0;">${escaped}</p>`;
    }
    return `<p style="margin: 5px 0;">${escaped}</p>`;
  }).join('');
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
 * Format body content - convert newlines to paragraphs with better formatting
 */
function formatBodyHTML(body: string): string {
  // Split by double newlines to separate paragraphs
  const paragraphs = body.split(/\n\n+/);

  return paragraphs
    .map(para => {
      // Escape HTML first
      const escaped = escapeHTML(para);
      // Check if it looks like a detail line (key: value format)
      if (para.match(/^\*\*.*\*\*:|^.*:/)) {
        return `<p style="margin: 5px 0; font-size: 14px; color: #555;">${escaped}</p>`;
      }
      // Check if it's a horizontal rule indicator
      if (para.trim() === '---' || para.trim() === '***') {
        return '<hr style="margin: 20px 0;" />';
      }
      // Wrap other paragraphs
      return `<p style="margin: 5px 0; font-size: 14px; color: #555;">${escaped}</p>`;
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
