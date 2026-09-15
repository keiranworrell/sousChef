-- Lets a collection be shared with named people and with a household.
--
-- A share is always narrow and always revocable: it names exactly one
-- recipient, either a user or a household, and it never makes anything public.
-- `collections.is_public` remains a separate and much blunter thing.
--
-- Sharing a collection grants read access to the recipes inside it, including
-- private ones. That is the deliberate product decision: "here's my collection"
-- means the whole collection, and the alternative — showing a recipient 2 of 8
-- recipes with no explanation — is worse for both sides. The UI says so before
-- the share is created.
--
-- Two target columns rather than two tables. A single `collection_shares` means
-- one access check to write and one place for it to be wrong, which matters
-- more here than schema tidiness: this is the area where the September
-- authorisation sweep found three broken checks.
CREATE TABLE IF NOT EXISTS collection_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

  -- Exactly one of these is set. See the CHECK below.
  shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_household_id UUID REFERENCES households(id) ON DELETE CASCADE,

  -- 'viewer' can read. 'editor' can also add and remove recipes. Neither can
  -- rename, delete, re-share, or change who else has access — those stay with
  -- the owner, so a share can never widen itself.
  role TEXT NOT NULL DEFAULT 'viewer',

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A row targeting both, or neither, has no meaning and would make the access
-- query's behaviour depend on which column it happened to check first.
ALTER TABLE collection_shares
  DROP CONSTRAINT IF EXISTS collection_shares_one_target;

ALTER TABLE collection_shares
  ADD CONSTRAINT collection_shares_one_target
  CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_household_id IS NULL)
    OR
    (shared_with_user_id IS NULL AND shared_with_household_id IS NOT NULL)
  );

ALTER TABLE collection_shares
  DROP CONSTRAINT IF EXISTS collection_shares_role_valid;

ALTER TABLE collection_shares
  ADD CONSTRAINT collection_shares_role_valid
  CHECK (role IN ('viewer', 'editor'));

-- Partial uniques rather than one composite: a NULL in a composite unique makes
-- the row unique against everything, so (collection, user, NULL) would not
-- collide with itself and the same person could be shared with repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS collection_shares_user_unique
  ON collection_shares (collection_id, shared_with_user_id)
  WHERE shared_with_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS collection_shares_household_unique
  ON collection_shares (collection_id, shared_with_household_id)
  WHERE shared_with_household_id IS NOT NULL;

-- "What has been shared with me" runs on every collections list load.
CREATE INDEX IF NOT EXISTS collection_shares_user_idx
  ON collection_shares (shared_with_user_id)
  WHERE shared_with_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collection_shares_household_idx
  ON collection_shares (shared_with_household_id)
  WHERE shared_with_household_id IS NOT NULL;
