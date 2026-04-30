import { neon } from "@neondatabase/serverless";

let sql;
let schemaPromise;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL.");
  }

  sql ||= neon(process.env.DATABASE_URL);
  return sql;
}

export async function ensureSchema() {
  if (!schemaPromise) {
    const db = getSql();
    schemaPromise = (async () => {
      await db`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await db`
        CREATE TABLE IF NOT EXISTS posts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id text NOT NULL,
          author_name text NOT NULL,
          author_email text NOT NULL,
          kind text NOT NULL CHECK (kind IN ('art', 'meetup', 'making')),
          body text NOT NULL DEFAULT '',
          image_url text,
          image_pathname text,
          image_content_type text,
          image_size integer,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC)`;
      await db`CREATE INDEX IF NOT EXISTS posts_kind_idx ON posts (kind)`;
      await db`
        CREATE TABLE IF NOT EXISTS post_reactions (
          post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id text NOT NULL,
          reaction text NOT NULL CHECK (reaction IN ('Spark', 'Cozy', 'Boost')),
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (post_id, user_id, reaction)
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS post_reactions_post_id_idx ON post_reactions (post_id)`;
      await db`
        CREATE TABLE IF NOT EXISTS post_comments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id text NOT NULL,
          author_name text NOT NULL,
          author_email text NOT NULL,
          body text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS post_comments_post_id_created_at_idx ON post_comments (post_id, created_at ASC)`;
      await db`
        CREATE TABLE IF NOT EXISTS group_chats (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          icon text NOT NULL DEFAULT 'GC',
          created_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS group_chats_updated_at_idx ON group_chats (updated_at DESC)`;
      await db`
        CREATE TABLE IF NOT EXISTS group_chat_messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          chat_id uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
          user_id text NOT NULL,
          author_name text NOT NULL,
          author_email text NOT NULL,
          body text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS group_chat_messages_chat_id_created_at_idx ON group_chat_messages (chat_id, created_at ASC)`;
    })();
  }

  return schemaPromise;
}
