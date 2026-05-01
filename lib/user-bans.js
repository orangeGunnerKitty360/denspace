import { evaluateAntiFurryBan } from "./moderation";

const BAN_ERROR = "This account has been permanently banned for anti-furry harassment.";

function displayNameFor(user) {
  return user?.name || String(user?.email || "").split("@")[0] || "Unknown user";
}

export function bannedResponse(ban) {
  return Response.json({
    banned: true,
    permanent: ban?.permanent !== false,
    error: BAN_ERROR,
    details: ban?.reason || "Automatic ban: anti-furry harassment detected."
  }, { status: 403 });
}

export async function getUserBan(db, user) {
  const rows = await db`
    SELECT *
    FROM user_bans
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function banUser(db, user, { reason, source, evidence }) {
  const rows = await db`
    INSERT INTO user_bans (
      user_id,
      user_email,
      user_name,
      reason,
      source,
      evidence,
      permanent
    )
    VALUES (
      ${user.id},
      ${user.email || ""},
      ${displayNameFor(user)},
      ${reason || "Automatic ban: anti-furry harassment detected."},
      ${source || "moderation"},
      ${String(evidence || "").slice(0, 500)},
      ${true}
    )
    ON CONFLICT (user_id) DO UPDATE
      SET reason = EXCLUDED.reason,
          source = EXCLUDED.source,
          evidence = EXCLUDED.evidence,
          permanent = true
    RETURNING *
  `;

  return rows[0];
}

export async function enforceUserBanStatus(db, user) {
  const existingBan = await getUserBan(db, user);
  if (existingBan) {
    return { blocked: true, response: bannedResponse(existingBan) };
  }

  const username = displayNameFor(user);
  const verdict = await evaluateAntiFurryBan({ username, context: "username" });

  if (!verdict.shouldBan) {
    return { blocked: false, response: null };
  }

  const ban = await banUser(db, user, {
    reason: verdict.reason,
    source: `username-${verdict.source}`,
    evidence: username
  });

  return { blocked: true, response: bannedResponse(ban) };
}

export async function enforceContentAutoBan(db, user, { text, context }) {
  const verdict = await evaluateAntiFurryBan({
    username: displayNameFor(user),
    text,
    context
  });

  if (!verdict.shouldBan) {
    return { banned: false, response: null };
  }

  const ban = await banUser(db, user, {
    reason: verdict.reason || (context === "comment"
      ? "Automatic permanent ban: anti-furry hate comment detected."
      : "Automatic ban: anti-furry harassment detected."),
    source: `${context}-${verdict.source}`,
    evidence: text
  });

  return { banned: true, response: bannedResponse(ban) };
}
