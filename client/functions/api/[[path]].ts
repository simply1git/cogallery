export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);

  // The frontend passes the backend URL via env variables in Cloudflare dashboard
  // Use the new Cloudflare Tunnel domain for the backend
  const backendUrl = env.VITE_BACKEND_URL || 'https://api.25012004.xyz';

  // Strip the /api prefix, keep the rest of the path and query params
  const targetPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = `${backendUrl}${targetPath}${url.search}`;

  // Clone the original request to preserve body and methods
  const proxyRequest = new Request(targetUrl, request); // Cloudflare Tunnels don't require warning bypass headers like Ngrok did.  
  
  // Forward the request to the Oracle Backend
  const response = await fetch(proxyRequest);

  // Create a new response to modify CORS headers if needed
  const proxiedResponse = new Response(response.body, response);
  
  // Cloudflare Pages automatically handles CORS for same-origin requests,
  // but we can enforce wide-open CORS just in case
  proxiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  
  return proxiedResponse;
}
