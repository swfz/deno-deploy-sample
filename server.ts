import { ulid } from "jsr:@std/ulid";

const kv = await Deno.openKv();

const logObject = async (now: Date, req: Request) => {
  const ts = Math.floor(now.getTime() / 1000);

  return {
    method: req.method,
    url: req.url,
    redirect: req.redirect,
    bodyUsed: req.bodyUsed,
    ...{ts: ts},
    headers: Object.fromEntries(req.headers.entries()),
    ...(req.body ? { body: await req.text() } : {})
  }
}

Deno.serve(async (request: Request) => {
  // Create short links
  if (request.method == "POST") {
    const body = await request.text();
    const { slug, url } = JSON.parse(body);
    const result = await kv.set(["links", slug], url);
    return new Response(JSON.stringify(result));
  }

  // Redirect short links
  const slug = request.url.split("/").pop() || "";
  const url = (await kv.get(["links", slug])).value as string;

  // logging cache 90 days
  const now = new Date()
  const logRecord = await logObject(now, request);
  await kv.set(["logs", now.getFullYear(), now.getMonth() + 1, now.getDate(), ulid()], logRecord, { expireIn: 1000 * 60 * 60 * 24 * 90 });

  if (url) {
    return Response.redirect(url, 301);
  } else {
    const m = !slug ? "Please provide a slug." : `Slug "${slug}" not found`;
    return new Response(m, { status: 404 });
  }
});