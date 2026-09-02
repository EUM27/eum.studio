export const PUBLISHING_FORM_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS publishing_form_templates (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      scope TEXT NOT NULL CHECK (scope IN ('base', 'partner')),
      partner_id TEXT,
      source_template_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      CHECK (
        (scope = 'base' AND partner_id IS NULL AND source_template_id IS NULL)
        OR
        (scope = 'partner' AND partner_id IS NOT NULL)
      ),
      FOREIGN KEY (partner_id)
        REFERENCES publishing_partners (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (source_template_id)
        REFERENCES publishing_form_templates (id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS publishing_form_templates_active_base_idx
    ON publishing_form_templates (scope)
    WHERE scope = 'base' AND retired_at IS NULL
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS publishing_form_templates_active_partner_idx
    ON publishing_form_templates (partner_id)
    WHERE scope = 'partner' AND retired_at IS NULL
  `,
  `
    CREATE TABLE IF NOT EXISTS publishing_form_responses (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_revision INTEGER NOT NULL CHECK (template_revision >= 1),
      answers_json TEXT NOT NULL,
      UNIQUE (work_id, partner_id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (partner_id)
        REFERENCES publishing_partners (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (template_id)
        REFERENCES publishing_form_templates (id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS publishing_form_responses_work_updated_idx
    ON publishing_form_responses (work_id, updated_at DESC, id ASC)
  `,
]);

export const PUBLISHING_FORM_SCHEMA_SQL =
  `${PUBLISHING_FORM_SCHEMA_STATEMENTS.join(";\n")};`;
