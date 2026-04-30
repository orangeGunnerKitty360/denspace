export function normalizeChatIcon(icon) {
  const trimmed = String(icon || "").trim();
  if (!trimmed) return "GC";
  return Array.from(trimmed).slice(0, 3).join("");
}

export function serializeChat(row) {
  return {
    id: row.id,
    name: row.name,
    icon: normalizeChatIcon(row.icon),
    messageCount: Number(row.message_count || 0),
    latestMessage: row.latest_message || "",
    time: formatRelativeTime(row.updated_at || row.created_at)
  };
}

export function serializeChatMessage(row) {
  return {
    id: row.id,
    author: row.author_name,
    handle: row.author_email,
    avatar: row.author_name?.slice(0, 3) || "You",
    text: row.body || "",
    time: formatRelativeTime(row.created_at)
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
