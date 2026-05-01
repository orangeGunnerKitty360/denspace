import { getAuth } from "../../../../lib/auth/server";
import { ensureSchema, getSql } from "../../../../lib/db";
import { enforceUserBanStatus, getUserBan } from "../../../../lib/user-bans";

export const runtime = "nodejs";

export async function GET() {
  const { data: session } = await getAuth().getSession();
  const user = session?.user;

  if (!user) {
    return Response.json({ signedIn: false, banned: false });
  }

  await ensureSchema();
  const db = getSql();
  await enforceUserBanStatus(db, user);
  const ban = await getUserBan(db, user);

  if (!ban) {
    return Response.json({ signedIn: true, banned: false });
  }

  return Response.json({
    signedIn: true,
    banned: true,
    permanent: ban.permanent !== false,
    error: "This account has been permanently banned.",
    details: ban.reason || "Automatic ban: anti-furry harassment detected.",
    reason: ban.reason,
    source: ban.source,
    createdAt: ban.created_at
  });
}
