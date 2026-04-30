import { put } from "@vercel/blob";
import { ensureSchema, getSql } from "../../../lib/db";
import { getAuth } from "../../../lib/auth/server";
import { POST_KINDS, serializePost } from "../../../lib/posts";

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
      COALESCE(
        jsonb_object_agg(reaction_counts.reaction, reaction_counts.count) FILTER (WHERE reaction_counts.reaction IS NOT NULL),
        '{}'::jsonb
      ) AS reactions
    FROM posts
    LEFT JOIN (
      SELECT post_id, reaction, count(*)::int AS count
      FROM post_reactions
      GROUP BY post_id, reaction
    ) AS reaction_counts ON reaction_counts.post_id = posts.id
    WHERE (${kind} = 'all' OR posts.kind = ${kind})
      AND (
        ${query} = ''
        OR lower(posts.body) LIKE ${search}
        OR lower(posts.author_name) LIKE ${search}
        OR lower(posts.author_email) LIKE ${search}
        OR lower(posts.kind) LIKE ${search}
      )
    GROUP BY posts.id
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

  const db = getSql();
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

  return Response.json({ post: serializePost({ ...rows[0], reactions: {} }) }, { status: 201 });
}
