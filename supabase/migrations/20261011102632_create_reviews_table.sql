/*
# Create reviews table for persistent Google Play review storage

1. New Tables
- `reviews`
  - `review_id` (text, primary key) — Google Play's unique source review ID, used as the upsert key
  - `source` (text, not null, default 'google_play') — review source identifier
  - `rating` (smallint, not null, check 1-5) — star rating
  - `title` (text, nullable) — review title, verbatim from source
  - `text` (text, nullable) — review body text, verbatim from source
  - `posted_at` (timestamptz, not null) — when the review was posted on Google Play
  - `app_version` (text, nullable) — app version the reviewer was using
  - `thumbs_up_count` (integer, nullable) — helpful votes count
  - `developer_response_text` (text, nullable) — developer reply text, verbatim
  - `developer_response_at` (timestamptz, nullable) — when the developer replied
  - `collected_via` (text, not null) — which collection pass found this review ('newest' or 'helpfulness')
  - `first_collected_at` (timestamptz, not null, default now()) — when this review was first saved to the database
  - `last_updated_at` (timestamptz, not null, default now()) — when this row was last upserted

- `collection_runs`
  - `id` (uuid, primary key, default gen_random_uuid()) — unique run identifier
  - `fetched_at` (timestamptz, not null, default now()) — when the collection run completed
  - `package_id` (text, not null) — app package ID collected
  - `storefront_country` (text, not null) — Play Store country code
  - `storefront_language` (text, not null) — Play Store language code
  - `target_unique_count` (integer, not null) — configured target
  - `retained_count` (integer, not null) — reviews retained this run
  - `fetched_count` (integer, not null) — raw items from Google Play
  - `invalid_count` (integer, not null) — items dropped as invalid
  - `duplicate_count` (integer, not null) — duplicates removed
  - `complete` (boolean, not null) — whether all passes ran without errors
  - `target_reached` (boolean, not null) — whether the target was met
  - `duration_ms` (integer, not null) — collection duration
  - `warnings` (jsonb, not null, default '[]') — collection warnings array
  - `quality` (jsonb, not null) — dataset quality summary (rating distribution, date range, etc.)
  - `new_review_ids` (jsonb, not null, default '[]') — IDs of reviews that were newly inserted (not previously stored)
  - `updated_review_ids` (jsonb, not null, default '[]') — IDs of reviews that already existed and were updated

2. Indexes
- `idx_reviews_posted_at` on `reviews(posted_at DESC)` — for listing reviews by date
- `idx_reviews_rating` on `reviews(rating)` — for filtering by star rating
- `idx_collection_runs_fetched_at` on `collection_runs(fetched_at DESC)` — for latest-first listing

3. Security
- Enable RLS on both tables.
- This is a single-tenant app with no sign-in screen, so all CRUD is allowed for both anon and authenticated roles. The data is intentionally shared/public.

4. Important Notes
- The `reviews` table uses `review_id` (Google Play's source ID) as the primary key, enabling upserts that prevent duplicate reviews across collection runs.
- Original review text, title, and developer responses are preserved verbatim.
- The `collection_runs` table records each fetch operation's metadata, including which reviews were newly inserted vs already known.
- All timestamps are stored as `timestamptz` for proper timezone handling.
*/

CREATE TABLE IF NOT EXISTS reviews (
  review_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'google_play',
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  text text,
  posted_at timestamptz NOT NULL,
  app_version text,
  thumbs_up_count integer,
  developer_response_text text,
  developer_response_at timestamptz,
  collected_via text NOT NULL,
  first_collected_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_posted_at ON reviews (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews (rating);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reviews" ON reviews;
CREATE POLICY "anon_select_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reviews" ON reviews;
CREATE POLICY "anon_update_reviews" ON reviews FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reviews" ON reviews;
CREATE POLICY "anon_delete_reviews" ON reviews FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  package_id text NOT NULL,
  storefront_country text NOT NULL,
  storefront_language text NOT NULL,
  target_unique_count integer NOT NULL,
  retained_count integer NOT NULL,
  fetched_count integer NOT NULL,
  invalid_count integer NOT NULL,
  duplicate_count integer NOT NULL,
  complete boolean NOT NULL,
  target_reached boolean NOT NULL,
  duration_ms integer NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality jsonb NOT NULL,
  new_review_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_review_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_collection_runs_fetched_at ON collection_runs (fetched_at DESC);

ALTER TABLE collection_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_collection_runs" ON collection_runs;
CREATE POLICY "anon_select_collection_runs" ON collection_runs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_collection_runs" ON collection_runs;
CREATE POLICY "anon_insert_collection_runs" ON collection_runs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_collection_runs" ON collection_runs;
CREATE POLICY "anon_update_collection_runs" ON collection_runs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_collection_runs" ON collection_runs;
CREATE POLICY "anon_delete_collection_runs" ON collection_runs FOR DELETE
  TO anon, authenticated USING (true);