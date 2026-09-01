-- ═══════════════════════════════════════════════════════════════════════════
--  008 — Bind a posting to the drawer it was taken at (A09)
-- ═══════════════════════════════════════════════════════════════════════════
--
--  `cashier_sessions` has always been able to open a shift, hand it over and
--  close it with a counted variance. What it could never do is say *which
--  postings* that variance was a variance of: `charge_postings` carried
--  `cashier_name VARCHAR(100)` — free text, written by no code path in the
--  repository, and with no key to the session — so a drawer could not be
--  reconciled against its own takings. A shift closed £40 down and nothing in
--  the system could tell you which forty pounds.
--
--  `cashier_session_id` is that key. Nullable on purpose and permanently so:
--  most postings are not taken at a drawer at all. A night audit's room-and-tax
--  run, a routed charge landing on a master folio, an OTA's deposit — none of
--  those has a cashier, and a NOT NULL column would have forced every one of
--  them to invent a session. What the column means is "this posting belongs to
--  that drawer", and NULL means "no drawer was involved", which is a true
--  statement rather than missing data.
--
--  The FK is ON DELETE SET NULL rather than RESTRICT: a session is operational
--  history, and if one is ever removed the posting is still a real posting.
--  Losing the attribution is worse than nothing but far better than a delete
--  that fails or a cascade that takes revenue with it.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE charge_postings
    ADD COLUMN IF NOT EXISTS cashier_session_id UUID;

COMMENT ON COLUMN charge_postings.cashier_session_id IS
    'The open cashier session this posting was taken at; NULL when no drawer was involved (night audit, routing, automated posting). FK cashier_sessions.session_id.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'charge_postings_cashier_session_fk'
    ) THEN
        ALTER TABLE charge_postings
            ADD CONSTRAINT charge_postings_cashier_session_fk
            FOREIGN KEY (cashier_session_id)
            REFERENCES cashier_sessions (session_id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- The reconciliation query this exists for: every posting of one session.
-- Partial, because the overwhelming majority of postings carry no session and
-- indexing them would be paying for rows the query never wants.
CREATE INDEX IF NOT EXISTS idx_charge_postings_cashier_session
    ON charge_postings (tenant_id, cashier_session_id)
    WHERE cashier_session_id IS NOT NULL;
