import { ensureSchema, getSql } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/auth/server";
import { serializeComment } from "../../../../../lib/posts";
import { moderatePostContent } from "../../../../../lib/moderation";
import { enforceCommentHateAutoBan, enforceUserBanStatus } from "../../../../../lib/user-bans";

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

  const hateBan = await enforceCommentHateAutoBan(db, user, { text });
  if (hateBan.banned) return hateBan.response;

  const moderation = await moderatePostContent({ text });

  if (!moderation.allowed) {
    return Response.json({
      error: "This comment was blocked by moderation.",
      details: moderation.reason
    }, { status: 422 });
  }

  const post = await db`
    SELECT id
    FROM posts
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!post.length) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const rows = await db`
    INSERT INTO post_comments (
      post_id,
      user_id,
      author_name,
      author_email,
      body
    )
    VALUES (
      ${id},
      ${user.id},
      ${user.name || user.email},
      ${user.email},
      ${text}
    )
    RETURNING *
  `;

  return Response.json({ comment: serializeComment(rows[0]) }, { status: 201 });
}
