import { evaluateAntiFurryBan, evaluateCommentHateBan } from "./moderation";

const BAN_ERROR = "This account has been permanently banned for hateful or harassing behavior.";

function displayNameFor(user) {
  return user?.name || String(user?.email || "").split("@")[0] || "Unknown user";
}

export function bannedResponse(ban) {
  return Response.json({
    banned: true,
    permanent: ban?.permanent !== false,
    error: BAN_ERROR,
    details: ban?.reason || "Automatic ban: anti-furry harassment detected.",
    removed: ban?.removed || { comments: 0, chatMessages: 0 }
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

async function deleteUserGeneratedMessages(db, user) {
  const email = String(user.email || "");
  const emailLocalPart = email ? email.split("@")[0].toLowerCase() : "__no_email__";
  const name = displayNameFor(user).toLowerCase();

  const comments = await db`
    DELETE FROM post_comments
    WHERE user_id = ${user.id}
       OR lower(author_email) = lower(${email})
       OR lower(author_name) = ${name}
       OR lower(split_part(author_email, '@', 1)) = ${emailLocalPart}
    RETURNING id
  `;

  const chatMessages = await db`
    DELETE FROM group_chat_messages
    WHERE user_id = ${user.id}
       OR lower(author_email) = lower(${email})
       OR lower(author_name) = ${name}
       OR lower(split_part(author_email, '@', 1)) = ${emailLocalPart}
    RETURNING id
  `;

  return {
    comments: comments.length,
    chatMessages: chatMessages.length
  };
}

async function withRemovedUserMessages(db, user, ban) {
  const removed = await deleteUserGeneratedMessages(db, user);
  return {
    ...ban,
    removed
  };
}

export async function banUser(db, user, { reason, source, evidence }) {
  const removed = await deleteUserGeneratedMessages(db, user);
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

  return {
    ...rows[0],
    removed
  };
}

export async function enforceUserBanStatus(db, user) {
  const existingBan = await getUserBan(db, user);
  if (existingBan) {
    const ban = await withRemovedUserMessages(db, user, existingBan);
    return { blocked: true, response: bannedResponse(ban) };
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

export async function enforceCommentHateAutoBan(db, user, { text }) {
  const verdict = await evaluateCommentHateBan({
    username: displayNameFor(user),
    text
  });

  if (!verdict.shouldBan) {
    return { banned: false, response: null };
  }

  const ban = await banUser(db, user, {
    reason: verdict.reason || "Automatic permanent ban: hateful or harassing comment detected.",
    source: `comment-${verdict.source}`,
    evidence: text
  });

  return { banned: true, response: bannedResponse(ban) };
}
