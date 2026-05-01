import { put } from "@vercel/blob";
import { ensureSchema, getSql } from "../../../lib/db";
import { getAuth } from "../../../lib/auth/server";
import { POST_KINDS, serializePost } from "../../../lib/posts";
import { moderatePostContent } from "../../../lib/moderation";
import { enforceContentAutoBan, enforceUserBanStatus } from "../../../lib/user-bans";

export const runtime = "nodejs";

async function getCurrentUser() {
  const { data: session } = await getAuth().getSession();
  return session?.user || null;
}

export async function GET(request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";
  const query = (searchParams.get("q") || "").trim();
  const kind = POST_KINDS.has(filter) ? filter : "all";
  const search = `%${query.toLowerCase()}%`;
  const db = getSql();

  const rows = await db`
    SELECT
      posts.*,
      COALESCE(reaction_counts.reactions, '{}'::jsonb) AS reactions,
      COALESCE(comment_rows.comments, '[]'::jsonb) AS comments
    FROM posts
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(reaction_counts.reaction, reaction_counts.count) AS reactions
      FROM (
        SELECT reaction, count(*)::int AS count
        FROM post_reactions
        WHERE post_id = posts.id
        GROUP BY reaction
      ) AS reaction_counts
    ) AS reaction_counts ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', limited_comments.id,
          'author_name', limited_comments.author_name,
          'author_email', limited_comments.author_email,
          'body', limited_comments.body,
          'created_at', limited_comments.created_at
        )
        ORDER BY limited_comments.created_at ASC
      ) AS comments
      FROM (
        SELECT id, author_name, author_email, body, created_at
        FROM post_comments
        WHERE post_id = posts.id
          AND NOT EXISTS (
            SELECT 1
            FROM user_bans
            WHERE user_bans.user_id = post_comments.user_id
               OR lower(user_bans.user_email) = lower(post_comments.author_email)
          )
        ORDER BY created_at ASC
      ) AS limited_comments
    ) AS comment_rows ON true
    WHERE (${kind} = 'all' OR posts.kind = ${kind})
      AND (
        ${query} = ''
        OR lower(posts.body) LIKE ${search}
        OR lower(posts.author_name) LIKE ${search}
        OR lower(posts.author_email) LIKE ${search}
        OR lower(posts.kind) LIKE ${search}
      )
    ORDER BY posts.created_at DESC
    LIMIT 50
  `;

  return Response.json({ posts: rows.map(serializePost) });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in before posting." }, { status: 401 });
  }

  await ensureSchema();
  const db = getSql();
  const banStatus = await enforceUserBanStatus(db, user);
  if (banStatus.blocked) return banStatus.response;

  const formData = await request.formData();
  const text = String(formData.get("text") || "").trim().slice(0, 280);
  const kind = String(formData.get("kind") || "art");
  const file = formData.get("image");

  if (!POST_KINDS.has(kind)) {
    return Response.json({ error: "Unknown post type." }, { status: 400 });
  }

  if (!text && !(file instanceof File && file.size > 0)) {
    return Response.json({ error: "Add text or an image before posting." }, { status: 400 });
  }

  if (text) {
    const contentBan = await enforceContentAutoBan(db, user, { text, context: "post" });
    if (contentBan.banned) return contentBan.response;
  }

  const moderation = await moderatePostContent({
    text,
    imageName: file instanceof File ? file.name : ""
  });

  if (!moderation.allowed) {
    return Response.json({
      error: "This post was blocked by moderation.",
      details: moderation.reason
    }, { status: 422 });
  }

  let blob = null;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "Uploads must be images." }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-90);
    blob = await put(`posts/${user.id}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type
    });
  }

  const rows = await db`
    INSERT INTO posts (
      user_id,
      author_name,
      author_email,
      kind,
      body,
      image_url,
      image_pathname,
      image_content_type,
      image_size
    )
    VALUES (
      ${user.id},
      ${user.name || user.email},
      ${user.email},
      ${kind},
      ${text},
      ${blob?.url || null},
      ${blob?.pathname || null},
      ${file instanceof File ? file.type : null},
      ${file instanceof File ? file.size : null}
    )
    RETURNING *
  `;

  return Response.json({ post: serializePost({ ...rows[0], reactions: {}, comments: [] }) }, { status: 201 });
}
