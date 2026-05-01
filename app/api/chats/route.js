import { ensureSchema, getSql } from "../../../lib/db";
import { getAuth } from "../../../lib/auth/server";
import { normalizeChatIcon, serializeChat } from "../../../lib/chats";
import { moderatePostContent } from "../../../lib/moderation";
import { enforceContentAutoBan, enforceUserBanStatus } from "../../../lib/user-bans";

export const runtime = "nodejs";

async function getCurrentUser() {
  const { data: session } = await getAuth().getSession();
  return session?.user || null;
}

export async function GET() {
  await ensureSchema();
  const db = getSql();
  const rows = await db`
    SELECT
      group_chats.*,
      COALESCE(message_counts.count, 0)::int AS message_count,
      latest_message.body AS latest_message
    FROM group_chats
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS count
      FROM group_chat_messages
      WHERE chat_id = group_chats.id
    ) AS message_counts ON true
    LEFT JOIN LATERAL (
      SELECT body
      FROM group_chat_messages
      WHERE chat_id = group_chats.id
      ORDER BY created_at DESC
      LIMIT 1
    ) AS latest_message ON true
    ORDER BY group_chats.updated_at DESC
    LIMIT 25
  `;

  return Response.json({ chats: rows.map(serializeChat) });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in before creating a group chat." }, { status: 401 });
  }

  await ensureSchema();
  const db = getSql();
  const banStatus = await enforceUserBanStatus(db, user);
  if (banStatus.blocked) return banStatus.response;

  const { name: rawName, icon: rawIcon } = await request.json();
  const name = String(rawName || "").trim().slice(0, 42);
  const icon = normalizeChatIcon(rawIcon);

  if (!name) {
    return Response.json({ error: "Name the group chat first." }, { status: 400 });
  }

  const contentBan = await enforceContentAutoBan(db, user, { text: name, context: "chat name" });
  if (contentBan.banned) return contentBan.response;

  const moderation = await moderatePostContent({ text: name });
  if (!moderation.allowed) {
    return Response.json({
      error: "This chat name was blocked by moderation.",
      details: moderation.reason
    }, { status: 422 });
  }

  const rows = await db`
    INSERT INTO group_chats (name, icon, created_by)
    VALUES (${name}, ${icon}, ${user.id})
    RETURNING *, 0::int AS message_count, ''::text AS latest_message
  `;

  return Response.json({ chat: serializeChat(rows[0]) }, { status: 201 });
}
