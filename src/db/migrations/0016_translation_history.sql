CREATE TABLE IF NOT EXISTS "translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "source_lang" text NOT NULL,
  "target_lang" text NOT NULL,
  "domain" text,
  "paragraph_count" integer,
  "source_preview" text,
  "translated_preview" text,
  "source_text" text,
  "translated_text" text,
  "user_id" text NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "translations_user_id_idx" ON "translations" ("user_id");
CREATE INDEX IF NOT EXISTS "translations_created_at_idx" ON "translations" ("created_at" DESC);
