import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('./resources/entries_000000_to_000044.json', 'utf8'));

const SYSTEM_FIELDS = new Set([
  '_version', '_content_type_uid', 'ACL', '_in_progress',
  'created_at', 'created_by', 'updated_at', 'updated_by',
  'publish_details', 'branch'
]);

const cleaned = data.entries.map(entry => {
  const result = {};
  for (const [k, v] of Object.entries(entry)) {
    if (!SYSTEM_FIELDS.has(k)) result[k] = v;
  }
  return result;
});

writeFileSync('./resources/entries_cleaned.json', JSON.stringify(cleaned, null, 2));
console.log(`Done: ${cleaned.length} entries written to resources/entries_cleaned.json`);
