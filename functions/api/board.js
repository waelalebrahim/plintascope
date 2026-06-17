// Cloudflare Pages Function: community board (ideas + feedback) backed by D1.
// Endpoint: /api/board
//   GET                      -> { posts: [...] }            (newest first, email never returned)
//   POST { email, message, name?, type } -> { ok, post }    (create a post)
//   POST { vote: id }        -> { ok, votes }               (upvote a post)
//
// Requires a D1 database bound to this Pages project as  DB.
// Table is created by schema.sql (run once in the D1 console).

function json(o, s){
  return new Response(JSON.stringify(o), {
    status: s || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequestGet(context){
  const db = context.env.DB;
  if(!db) return json({ error: "Database not connected. Bind a D1 database to this project as DB." }, 500);
  try{
    const rs = await db.prepare(
      "SELECT id, type, name, message, votes, created_at FROM posts ORDER BY votes DESC, created_at DESC LIMIT 200"
    ).all();
    return json({ posts: rs.results || [] });
  }catch(e){ return json({ error: String(e) }, 500); }
}

export async function onRequestPost(context){
  const db = context.env.DB;
  if(!db) return json({ error: "Database not connected. Bind a D1 database to this project as DB." }, 500);

  let b;
  try{ b = await context.request.json(); }catch(e){ return json({ error: "Bad request." }, 400); }

  try{
    // upvote
    if(b && b.vote){
      const id = parseInt(b.vote, 10);
      if(!id) return json({ error: "Bad id." }, 400);
      await db.prepare("UPDATE posts SET votes = votes + 1 WHERE id = ?").bind(id).run();
      const row = await db.prepare("SELECT votes FROM posts WHERE id = ?").bind(id).first();
      return json({ ok: true, votes: row ? row.votes : null });
    }

    // honeypot: silently accept and drop bot submissions
    if(b && b.hp){ return json({ ok: true }); }

    const email = (b.email || "").trim();
    const message = (b.message || "").trim();
    const name = (b.name || "").trim().slice(0, 40);
    let type = (b.type || "idea").toLowerCase();
    if(type !== "idea" && type !== "feedback") type = "idea";

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(!emailOk) return json({ error: "Please enter a valid email." }, 400);
    if(message.length < 3 || message.length > 1000) return json({ error: "Message must be 3 to 1000 characters." }, 400);

    const now = Math.floor(Date.now() / 1000);
    const res = await db.prepare(
      "INSERT INTO posts (type, name, email, message, votes, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).bind(type, name || null, email, message, now).run();

    const id = res.meta && res.meta.last_row_id;
    return json({ ok: true, post: { id: id, type: type, name: name || null, message: message, votes: 0, created_at: now } });
  }catch(e){ return json({ error: String(e) }, 500); }
}
