// Cloudflare Pages Function: community board (posts + replies) backed by D1.
// Endpoint: /api/board
//   GET                                   -> { posts: [ {..., replies:[...]} ] }
//   POST { email, message, name?, type }  -> { ok, post }     (create a post)
//   POST { reply_to, email, message, name?} -> { ok, reply }  (reply to a post)
//   POST { vote: id }                     -> { ok, votes }    (upvote a post)
//
// Email is stored but never returned. Requires a D1 database bound as DB.
// Tables are created by schema.sql (run once in the D1 console).

function json(o, s){
  return new Response(JSON.stringify(o), {
    status: s || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestGet(context){
  const db = context.env.DB;
  if(!db) return json({ error: "Database not connected. Bind a D1 database to this project as DB." }, 500);
  try{
    const postsRs = await db.prepare(
      "SELECT id, type, name, message, votes, created_at FROM posts ORDER BY votes DESC, created_at DESC LIMIT 200"
    ).all();
    const posts = postsRs.results || [];

    // Replies are optional: if the table isn't created yet, the board still works.
    let replies = [];
    if(posts.length){
      try{
        const repRs = await db.prepare(
          "SELECT id, post_id, name, message, created_at FROM replies ORDER BY created_at ASC LIMIT 1000"
        ).all();
        replies = repRs.results || [];
      }catch(e){ replies = []; }
    }
    const byPost = {};
    replies.forEach(function(r){ (byPost[r.post_id] = byPost[r.post_id] || []).push(r); });
    posts.forEach(function(p){ p.replies = byPost[p.id] || []; });

    return json({ posts: posts });
  }catch(e){ return json({ error: String(e) }, 500); }
}

export async function onRequestPost(context){
  const db = context.env.DB;
  if(!db) return json({ error: "Database not connected. Bind a D1 database to this project as DB." }, 500);

  let b;
  try{ b = await context.request.json(); }catch(e){ return json({ error: "Bad request." }, 400); }

  try{
    // upvote a post
    if(b && b.vote){
      const id = parseInt(b.vote, 10);
      if(!id) return json({ error: "Bad id." }, 400);
      await db.prepare("UPDATE posts SET votes = votes + 1 WHERE id = ?").bind(id).run();
      const row = await db.prepare("SELECT votes FROM posts WHERE id = ?").bind(id).first();
      return json({ ok: true, votes: row ? row.votes : null });
    }

    // honeypot: silently accept and drop bot submissions
    if(b && b.hp){ return json({ ok: true }); }

    // reply to a post
    if(b && b.reply_to){
      const pid = parseInt(b.reply_to, 10);
      if(!pid) return json({ error: "Bad post id." }, 400);
      const remail = (b.email || "").trim();
      const rmsg = (b.message || "").trim();
      const rname = (b.name || "").trim().slice(0, 40);
      if(!emailRe.test(remail)) return json({ error: "Please enter a valid email." }, 400);
      if(rmsg.length < 3 || rmsg.length > 1000) return json({ error: "Reply must be 3 to 1000 characters." }, 400);

      const parent = await db.prepare("SELECT id FROM posts WHERE id = ?").bind(pid).first();
      if(!parent) return json({ error: "That post no longer exists." }, 400);

      const now = Math.floor(Date.now() / 1000);
      const res = await db.prepare(
        "INSERT INTO replies (post_id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(pid, rname || null, remail, rmsg, now).run();
      const id = res.meta && res.meta.last_row_id;
      return json({ ok: true, reply: { id: id, post_id: pid, name: rname || null, message: rmsg, created_at: now } });
    }

    // create a post
    const email = (b.email || "").trim();
    const message = (b.message || "").trim();
    const name = (b.name || "").trim().slice(0, 40);
    let type = (b.type || "idea").toLowerCase();
    if(type !== "idea" && type !== "feedback") type = "idea";

    if(!emailRe.test(email)) return json({ error: "Please enter a valid email." }, 400);
    if(message.length < 3 || message.length > 1000) return json({ error: "Message must be 3 to 1000 characters." }, 400);

    const now = Math.floor(Date.now() / 1000);
    const res = await db.prepare(
      "INSERT INTO posts (type, name, email, message, votes, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).bind(type, name || null, email, message, now).run();

    const id = res.meta && res.meta.last_row_id;
    return json({ ok: true, post: { id: id, type: type, name: name || null, message: message, votes: 0, created_at: now, replies: [] } });
  }catch(e){ return json({ error: String(e) }, 500); }
}
