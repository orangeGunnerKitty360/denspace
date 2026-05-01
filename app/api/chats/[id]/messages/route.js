import { ensureSchema, getSql } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/auth/server";
import { serializeChatMessage } from "../../../../../lib/chats";
import { moderatePostContent } from "../../../../../lib/moderation";
import { enforceContentAutoBan, enforceUserBanStatus } from "../../../../../lib/user-bans";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  await ensureSchema();
  const { id } = await params;
  const db = getSql();
  const rows = await db`
    SELECT *
    FROM group_chat_messages
    WHERE chat_id = ${id}
      AND NOT EXISTS (
        SELECT 1
        FROM user_bans
        WHERE user_bans.user_id = group_chat_messages.user_id
           OR lower(user_bans.user_email) = lower(group_chat_messages.author_email)
      )
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
  const db = getSql();
  const banStatus = await enforceUserBanStatus(db, user);
  if (banStatus.blocked) return banStatus.response;

  const { id } = await params;
  const { text: rawText } = await request.json();
  const text = String(rawText || "").trim().slice(0, 420);

  if (!text) {
    return Response.json({ error: "Write a message before sending." }, { status: 400 });
  }

  const contentBan = await enforceContentAutoBan(db, user, { text, context: "chat message" });
  if (contentBan.banned) return contentBan.response;

  const moderation = await moderatePostContent({ text });
  if (!moderation.allowed) {
    return Response.json({
      error: "This message was blocked by moderation.",
      details: moderation.reason
    }, { status: 422 });
  }

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
