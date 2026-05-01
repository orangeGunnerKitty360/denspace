import { ensureSchema, getSql } from "../../../../lib/db";
import { getAuth } from "../../../../lib/auth/server";
import { normalizeChatIcon, serializeChat } from "../../../../lib/chats";
import { moderatePostContent } from "../../../../lib/moderation";
import { enforceContentAutoBan, enforceUserBanStatus } from "../../../../lib/user-bans";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { data: session } = await getAuth().getSession();
  const user = session?.user;

  if (!user) {
    return Response.json({ error: "Sign in before editing a group chat." }, { status: 401 });
  }

  await ensureSchema();
  const db = getSql();
  const banStatus = await enforceUserBanStatus(db, user);
  if (banStatus.blocked) return banStatus.response;

  const { id } = await params;
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
    UPDATE group_chats
    SET name = ${name},
        icon = ${icon},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *,
      (
        SELECT count(*)::int
        FROM group_chat_messages
        WHERE chat_id = group_chats.id
      ) AS message_count,
      COALESCE(
        (
          SELECT body
          FROM group_chat_messages
          WHERE chat_id = group_chats.id
          ORDER BY created_at DESC
          LIMIT 1
        ),
        ''
      ) AS latest_message
  `;

  if (!rows.length) {
    return Response.json({ error: "Group chat not found." }, { status: 404 });
  }

  return Response.json({ chat: serializeChat(rows[0]) });
}
