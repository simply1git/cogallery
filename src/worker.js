// Cloudflare Worker for secure media proxy
// Serves media from R2 with authentication

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only serve media requests
    if (!url.pathname.startsWith('/media/')) {
      return new Response('Not Found', { status: 404 });
    }

    // Extract the media key from path
    const key = url.pathname.substring(7); // Remove '/media/'

    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify JWT token (simplified - implement proper verification)
    // In production, verify with your JWKS or secret
    if (!isValidToken(token)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch from R2 bucket
    try {
      const object = await env.COGALLERY_MEDIA.get(key);

      if (object === null) {
        return new Response('Not Found', { status: 404 });
      }

      // Get metadata from object
      const headers = new Headers();
      object.writeHttpMetadata(headers);

      // Set cache headers for better performance
      headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year

      return new Response(object.body, { headers });
    } catch (error) {
      console.error('Error fetching from R2:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

// Simple token validation (replace with proper JWT verification)
function isValidToken(token) {
  // In production, implement proper JWT verification:
  // 1. Decode token
  // 2. Verify signature using your secret/JWKS
  // 3. Check expiration
  // 4. Check audience/issuer

  // For now, just check if token exists and is reasonable length
  return token && token.length > 10;
}