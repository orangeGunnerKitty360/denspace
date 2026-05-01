import { put } from "@vercel/blob";
import { ensureSchema, getSql } from "../../../../lib/db";
import { getAuth } from "../../../../lib/auth/server";
import { enforceUserBanStatus } from "../../../../lib/user-bans";

export const runtime = "nodejs";

function serializeProfile(row, user) {
  return {
    displayName: row?.display_name || user.name || user.email || "You",
    avatarUrl: row?.avatar_url || user.image || "",
    avatarPathname: row?.avatar_pathname || "",
    updatedAt: row?.updated_at || null
  };
}

async function getCurrentUser() {
  const { data: session } = await getAuth().getSession();
  return session?.user || null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in before editing your profile." }, { status: 401 });
  }

  await ensureSchema();
  const db = getSql();
  const profiles = await db`
    SELECT *
    FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  return Response.json({ profile: serializeProfile(profiles[0], user) });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in before editing your profile." }, { status: 401 });
  }

  await ensureSchema();
  const db = getSql();
  const banStatus = await enforceUserBanStatus(db, user);
  if (banStatus.blocked) return banStatus.response;

  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File) || file.size <= 0) {
    return Response.json({ error: "Choose an image for your profile picture." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Profile pictures must be images." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "Profile pictures must be 5 MB or smaller." }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-90) || "profile-picture";
  const blob = await put(`profiles/${user.id}/${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type
  });

  const rows = await db`
    INSERT INTO user_profiles (
      user_id,
      user_email,
      display_name,
      avatar_url,
      avatar_pathname,
      avatar_content_type,
      avatar_size,
      updated_at
    )
    VALUES (
      ${user.id},
      ${user.email},
      ${user.name || user.email},
      ${blob.url},
      ${blob.pathname},
      ${file.type},
      ${file.size},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      user_email = excluded.user_email,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      avatar_pathname = excluded.avatar_pathname,
      avatar_content_type = excluded.avatar_content_type,
      avatar_size = excluded.avatar_size,
      updated_at = now()
    RETURNING *
  `;

  return Response.json({ profile: serializeProfile(rows[0], user) });
}
