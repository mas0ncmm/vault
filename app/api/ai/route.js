export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MODELS = ["claude-sonnet-5", "claude-haiku-4-5-20251001"];

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: { type: "config_error", message: "No API key set on the server. In Vercel go to Settings then Environment Variables, add ANTHROPIC_API_KEY, then redeploy." } },
      { status: 500 }
    );
  }

  const wanted = process.env.VAULT_PASSPHRASE;
  if (wanted) {
    const given = req.headers.get("x-vault-pass") || "";
    if (given !== wanted) {
      return Response.json(
        { error: { type: "authentication_error", message: "PASSPHRASE: wrong or missing app passphrase." } },
        { status: 401 }
      );
    }
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: { type: "bad_request", message: "Malformed request." } }, { status: 400 }); }

  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: { type: "bad_request", message: "Missing messages." } }, { status: 400 });
  }
  if (!ALLOWED_MODELS.includes(body.model)) {
    return Response.json({ error: { type: "bad_request", message: "Model not allowed: " + body.model } }, { status: 400 });
  }

  const payload = {
    model: body.model,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, 4000),
    messages: body.messages,
  };
  if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json(
      { error: { type: "network_error", message: "Could not reach the AI service: " + (e && e.message ? e.message : "unknown error") } },
      { status: 502 }
    );
  }
}
