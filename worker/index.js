/**
 * github-crud — Cloudflare Workers Auth Proxy
 *
 * Menukar OAuth code → access_token dengan aman.
 * client_secret disimpan di sini, tidak pernah menyentuh browser.
 *
 * Setup:
 *   npx wrangler secret put GH_CLIENT_ID
 *   npx wrangler secret put GH_CLIENT_SECRET
 *   npx wrangler secret put ALLOWED_ORIGIN   ← e.g. https://username.github.io
 *   npx wrangler deploy worker/index.js --name github-crud-auth
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);

    // POST /exchange  { code }  →  { access_token }
    if (url.pathname === '/exchange' && request.method === 'POST') {
      let code;
      try   { ({ code } = await request.json()); }
      catch { return reply({ error: 'Invalid JSON body' }, 400, origin); }

      if (!code) return reply({ error: 'Missing "code" field' }, 400, origin);

      const ghRes = await fetch('https://github.com/login/oauth/access_token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({
          client_id:     env.GH_CLIENT_ID,
          client_secret: env.GH_CLIENT_SECRET,
          code,
        }),
      });

      const data = await ghRes.json();
      if (data.error) return reply({ error: data.error_description || data.error }, 400, origin);

      return reply({ access_token: data.access_token }, 200, origin);
    }

    return reply({ error: 'Not found' }, 404, origin);
  },
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function reply(data, status, origin) {
  return Response.json(data, { status, headers: cors(origin) });
}
