-- Seed default environments for Postee
-- This migration creates standard environments: Development, Staging, Production

-- Insert Development environment (default)
INSERT OR IGNORE INTO postee_environments (id, name, description, is_default, created_at, updated_at)
VALUES (
    'dev',
    'Development',
    'Local development environment',
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- Insert Staging environment
INSERT OR IGNORE INTO postee_environments (id, name, description, is_default, created_at, updated_at)
VALUES (
    'staging',
    'Staging',
    'Pre-production testing environment',
    0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- Insert Production environment
INSERT OR IGNORE INTO postee_environments (id, name, description, is_default, created_at, updated_at)
VALUES (
    'prod',
    'Production',
    'Live production environment',
    0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- Seed some example variables for Development environment
INSERT OR IGNORE INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
VALUES (
    'dev',
    'API_BASE_URL',
    'http://localhost:3000',
    0,
    1,
    0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

INSERT OR IGNORE INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
VALUES (
    'dev',
    'API_KEY',
    'dev-api-key-12345',
    1,
    1,
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- Seed example variables for Staging environment
INSERT OR IGNORE INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
VALUES (
    'staging',
    'API_BASE_URL',
    'https://api.staging.example.com',
    0,
    1,
    0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

INSERT OR IGNORE INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
VALUES (
    'staging',
    'API_KEY',
    'staging-secret-key',
    1,
    1,
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- Seed example variables for Production environment
INSERT OR IGNORE INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
VALUES (
    'prod',
    'API_BASE_URL',
    'https://api.example.com',
    0,
    1,
    0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

INSERT OR IGNORE INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
VALUES (
    'prod',
    'API_KEY',
    'prod-secret-key-changeme',
    1,
    1,
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);
