import { ensureSchema, getSql } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/auth/server";
import { serializeComment } from "../../../../../lib/posts";
import { enforceAntiFurryCommentAutoBan, enforceUserBanStatus } from "../../../../../lib/user-bans";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { data: session } = await getAuth().getSession();
  const user = session?.user;

  if (!user) {
    return Response.json({ error: "Sign in before commenting." }, { status: 401 });
  }

  await ensureSchema();
  const db = getSql();
  const banStatus = await enforceUserBanStatus(db, user);
  if (banStatus.blocked) return banStatus.response;

  const { id } = await params;
  const { text: rawText } = await request.json();
  const text = String(rawText || "").trim().slice(0, 220);

  if (!text) {
    return Response.json({ error: "Write a comment before sending." }, { status: 400 });
  }

  const antiFurryBan = await enforceAntiFurryCommentAutoBan(db, user, { text });
  if (antiFurryBan.banned) return antiFurryBan.response;

  const post = await db`
    SELECT id
    FROM posts
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!post.length) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const profiles = await db`
    SELECT avatar_url
    FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `;
  const authorImageUrl = profiles[0]?.avatar_url || user.image || null;

  const rows = await db`
    INSERT INTO post_comments (
      post_id,
      user_id,
      author_name,
      author_email,
      author_image_url,
      body
    )
    VALUES (
      ${id},
      ${user.id},
      ${user.name || user.email},
      ${user.email},
      ${authorImageUrl},
      ${text}
    )
    RETURNING *
  `;

  return Response.json({ comment: serializeComment(rows[0]) }, { status: 201 });
}
