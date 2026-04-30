export const POST_KINDS = new Set(["art", "meetup", "making"]);
export const REACTIONS = new Set(["Spark", "Cozy", "Boost"]);

export function serializePost(row) {
  const reactions = row.reactions || {};

  return {
    id: row.id,
    author: row.author_name,
    handle: row.author_email,
    avatar: row.author_name?.slice(0, 3) || "You",
    avatarClass: "avatar-sun",
    provider: "neon-auth",
    time: formatRelativeTime(row.created_at),
    kind: row.kind,
    text: row.body || "",
    upload: row.image_url ? {
      src: row.image_url,
      name: row.image_pathname?.split("/").pop() || "Uploaded image",
      size: row.image_size || 0,
      type: row.image_content_type || "image"
    } : null,
    reactions: {
      Spark: Number(reactions.Spark || 0),
      Cozy: Number(reactions.Cozy || 0),
      Boost: Number(reactions.Boost || 0)
    },
    colors: row.kind === "meetup" ? ["#00a5d8", "#b6f23a"] : row.kind === "making" ? ["#46d96b", "#6d8dff"] : ["#00b8ff", "#ffffff"]
  };
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  return `${Math.floor(diff / day)}d`;
}
