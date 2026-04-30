import { ensureSchema, getSql } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/auth/server";
import { REACTIONS } from "../../../../../lib/posts";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { data: session } = await getAuth().getSession();
  const user = session?.user;

  if (!user) {
    return Response.json({ error: "Sign in before reacting." }, { status: 401 });
  }

  await ensureSchema();
  const { id } = await params;
  const { reaction } = await request.json();

  if (!REACTIONS.has(reaction)) {
    return Response.json({ error: "Unknown reaction." }, { status: 400 });
  }

  const db = getSql();
  const existing = await db`
    SELECT 1
    FROM post_reactions
    WHERE post_id = ${id}
      AND user_id = ${user.id}
      AND reaction = ${reaction}
    LIMIT 1
  `;

  if (existing.length) {
    await db`
      DELETE FROM post_reactions
      WHERE post_id = ${id}
        AND user_id = ${user.id}
        AND reaction = ${reaction}
    `;
  } else {
    await db`
      INSERT INTO post_reactions (post_id, user_id, reaction)
      VALUES (${id}, ${user.id}, ${reaction})
      ON CONFLICT DO NOTHING
    `;
  }

  const counts = await db`
    SELECT reaction, count(*)::int AS count
    FROM post_reactions
    WHERE post_id = ${id}
    GROUP BY reaction
  `;

  return Response.json({
    reactions: {
      Spark: Number(counts.find((item) => item.reaction === "Spark")?.count || 0),
      Cozy: Number(counts.find((item) => item.reaction === "Cozy")?.count || 0),
      Boost: Number(counts.find((item) => item.reaction === "Boost")?.count || 0)
    }
  });
}
