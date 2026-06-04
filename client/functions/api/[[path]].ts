export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);

  // The frontend passes the backend URL via env variables in Cloudflare dashboard
  // But since we are hardcoding the ngrok proxy for this specific user's backend, we can fallback to it
  const backendUrl = env.VITE_NGROK_URL || 'https://daytime-savings-rippling.ngrok-free.dev';

  // Strip the /api prefix, keep the rest of the path and query params
  const targetPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = `${backendUrl}${targetPath}${url.search}`;

  // Clone the original request to preserve body and methods
  const proxyRequest = new Request(targetUrl, request);

  // INJECT THE MAGIC NGROK BYPASS HEADER
  proxyRequest.headers.set('ngrok-skip-browser-warning', 'true');
  
  // Forward the request to the Oracle Backend
  const response = await fetch(proxyRequest);

  // Create a new response to modify CORS headers if needed
  const proxiedResponse = new Response(response.body, response);
  
  // Cloudflare Pages automatically handles CORS for same-origin requests,
  // but we can enforce wide-open CORS just in case
  proxiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  
  return proxiedResponse;
}
