-- Add icon mapping to nodes for customizable icon support
ALTER TABLE nodes ADD COLUMN icon_id TEXT;

UPDATE nodes
SET icon_id = CASE type
    WHEN 'person' THEN 'phosphor:user-duotone'
    WHEN 'system' THEN 'phosphor:package-duotone'
    WHEN 'externalSystem' THEN 'phosphor:cloud-duotone'
    WHEN 'container' THEN 'phosphor:stack-duotone'
    WHEN 'component' THEN 'phosphor:cube-duotone'
    ELSE icon_id
END
WHERE icon_id IS NULL;
