/**
 * Universal Email Renderer
 *
 * Renders structured email content into branded HTML and plain text formats.
 * All Execute emails use a consistent, professional layout.
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
/**
 * Render structured email content into both HTML and plain text formats
 */
export declare function renderEmail(content: EmailContent): RenderedEmail;
/**
 * Validate required fields in email content
 */
export declare function validateEmailContent(content: any): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=renderer.d.ts.map