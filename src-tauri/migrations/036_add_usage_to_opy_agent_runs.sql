-- Provider token usage on the OPY run envelope (Rig 0.40, Gate 2).
--
-- Rig 0.40 reports usage and the Effect boundary now validates it, but the board
-- surface had nowhere durable to put it. These columns join usage to the run
-- trail that already exists rather than opening a competing log, so audit, eval,
-- and future budget views read one record.
--
-- Nullable on purpose, and the distinction is load-bearing:
--
--   NULL  -- we never captured usage for this run (it predates 0.40, or it
--            failed before the provider answered)
--   0     -- the provider answered and reported no tokens
--
-- Collapsing those two would let a budget view read every historical run as
-- free. Postee stores the same measurement in `postee_agent_runs`; it keeps only
-- the three headline counters, while a board run keeps all seven because cache
-- and reasoning tokens price differently and a cost estimate needs them apart.

ALTER TABLE opy_agent_runs ADD COLUMN input_tokens INTEGER NULL;
ALTER TABLE opy_agent_runs ADD COLUMN output_tokens INTEGER NULL;
ALTER TABLE opy_agent_runs ADD COLUMN total_tokens INTEGER NULL;
ALTER TABLE opy_agent_runs ADD COLUMN cached_input_tokens INTEGER NULL;
ALTER TABLE opy_agent_runs ADD COLUMN cache_creation_input_tokens INTEGER NULL;
ALTER TABLE opy_agent_runs ADD COLUMN tool_use_prompt_tokens INTEGER NULL;
ALTER TABLE opy_agent_runs ADD COLUMN reasoning_tokens INTEGER NULL;
