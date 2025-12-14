/**
 * Message utility functions
 * Helper functions for generating message IDs and encoding
 */

/**
 * base64 for Unicode strings with a tiny hash fallback.
 */
export const safeBase64Encode = (str) => {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)))
    );
  } catch {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }
};

/**
 * Generate a unique message ID
 */
export const genId = (who, text, ts) =>
  safeBase64Encode(`${who || 'user'}-${(text || '').slice(0, 48)}-${ts}-${Math.random().toString(36).slice(2, 7)}`)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 16);

