import { ensureSchema, getSql } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/auth/server";
import { serializeChatMessage } from "../../../../../lib/chats";
import { moderatePostContent } from "../../../../../lib/moderation";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  await ensureSchema();
  const { id } = await params;
  const db = getSql();
  const rows = await db`
    SELECT *
    FROM group_chat_messages
    WHERE chat_id = ${id}
    ORDER BY created_at ASC
    LIMIT 80
  `;

  return Response.json({ messages: rows.map(serializeChatMessage) });
}

export async function POST(request, { params }) {
  const { data: session } = await getAuth().getSession();
  const user = session?.user;

  if (!user) {
    return Response.json({ error: "Sign in before chatting." }, { status: 401 });
  }

  await ensureSchema();
  const { id } = await params;
  const { text: rawText } = await request.json();
  const text = String(rawText || "").trim().slice(0, 420);

  if (!text) {
    return Response.json({ error: "Write a message before sending." }, { status: 400 });
  }

  const moderation = await moderatePostContent({ text });
  if (!moderation.allowed) {
    return Response.json({
      error: "This message was blocked by moderation.",
      details: moderation.reason
    }, { status: 422 });
  }

  const db = getSql();
  const chat = await db`
    SELECT id
    FROM group_chats
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!chat.length) {
    return Response.json({ error: "Group chat not found." }, { status: 404 });
  }

  const rows = await db`
    INSERT INTO group_chat_messages (
      chat_id,
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

  await db`
    UPDATE group_chats
    SET updated_at = now()
    WHERE id = ${id}
  `;

  return Response.json({ message: serializeChatMessage(rows[0]) }, { status: 201 });
}
