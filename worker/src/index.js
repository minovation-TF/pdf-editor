function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : (origin === allowed ? origin : allowed),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
}

function todayInSeoul() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function readCounts(db, day) {
  const rows = await db.prepare('SELECT key, value FROM counters WHERE key IN (?, ?)').bind('total', 'day:' + day).all();
  const values = Object.fromEntries((rows.results || []).map((row) => [row.key, Number(row.value) || 0]));
  return { date: day, today: values['day:' + day] || 0, total: values.total || 0 };
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    const day = todayInSeoul();
    try {
      if (request.method === 'GET' && url.pathname === '/api/stats') {
        return Response.json(await readCounts(env.DB, day), { headers });
      }
      if (request.method === 'POST' && url.pathname === '/api/visit') {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO counters (key, value, updated_at) VALUES ('total', 1, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = value + 1, updated_at = CURRENT_TIMESTAMP"),
          env.DB.prepare("INSERT INTO counters (key, value, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = value + 1, updated_at = CURRENT_TIMESTAMP").bind('day:' + day),
        ]);
        return Response.json(await readCounts(env.DB, day), { headers });
      }
      return Response.json({ error: 'Not found' }, { status: 404, headers });
    } catch (error) {
      return Response.json({ error: 'Counter unavailable' }, { status: 500, headers });
    }
  },
};
