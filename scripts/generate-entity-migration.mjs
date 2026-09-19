import fs from 'node:fs';
import path from 'node:path';

const entities = [
  'AgentConfig', 'CharacterSheet', 'ContactMessage', 'GameAIRequest',
  'GameConnection', 'GameCreation', 'GameElement', 'GameInterpretation',
  'GameLevel', 'GameSession', 'GameVisit', 'PromoMessageRequest', 'SalonStatus',
  'ScheduledPromo', 'SetAsset', 'SimActiveSituation', 'SimAsset', 'SimBelief',
  'SimCharacter', 'SimCharacterAction', 'SimClaim', 'SimConsequence',
  'SimInformationTransmission', 'SimLocation', 'SimObservation',
  'SimStateChange', 'SimWorldTime', 'StoryBlock', 'StorySession',
  'TemporaryUser', 'UserTimeline', 'VaultAsset', 'VaultFolder',
];

const snake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
function tableName(entity) {
  const value = snake(entity);
  if (entity.endsWith('Settings') || entity.endsWith('Earnings')) return value;
  if (value.endsWith('status')) return `${value}es`;
  if (value.endsWith('class')) return `${value}es`;
  if (value.endsWith('y')) return `${value.slice(0, -1)}ies`;
  return `${value}s`;
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function pgType(property) {
  const type = Array.isArray(property.type) ? property.type.find((value) => value !== 'null') : property.type;
  if (type === 'boolean') return 'boolean';
  if (type === 'integer') return 'bigint';
  if (type === 'number') return 'numeric';
  if (type === 'array' || type === 'object') return 'jsonb';
  if (property.format === 'date-time') return 'timestamptz';
  return 'text';
}
function defaultClause(property) {
  if (!Object.hasOwn(property, 'default')) return '';
  const type = Array.isArray(property.type) ? property.type.find((value) => value !== 'null') : property.type;
  if (property.default === null) return ' default null';
  if (['boolean', 'integer', 'number'].includes(type)) return ` default ${property.default}`;
  if (['array', 'object'].includes(type)) return ` default ${literal(JSON.stringify(property.default))}::jsonb`;
  return ` default ${literal(property.default)}`;
}

const sourceDir = path.resolve('../legacy-base44-reference/entities');
const sql = [];
for (const entity of entities) {
  const schema = JSON.parse(fs.readFileSync(path.join(sourceDir, `${entity}.jsonc`), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  const table = tableName(entity);
  const required = new Set(schema.required || []);
  const columns = [
    '  "id" uuid primary key default gen_random_uuid()',
    '  "created_date" timestamptz default now()',
    '  "updated_date" timestamptz default now()',
    '  "created_by_id" text',
  ];
  const checks = [];
  for (const [name, property] of Object.entries(schema.properties || {})) {
    columns.push(`  "${name}" ${pgType(property)}${defaultClause(property)}${required.has(name) ? ' not null' : ''}`);
    if (property.enum?.length) checks.push(`  constraint "${table}_${name}_check" check ("${name}" in (${property.enum.map(literal).join(', ')}))`);
  }
  columns.push(...checks);
  sql.push(`create table if not exists public."${table}" (\n${columns.join(',\n')}\n);`);
  sql.push(`alter table public."${table}" enable row level security;`);
  for (const indexed of ['user_email', 'session_id', 'simulation_run_id', 'theme_id']) {
    if (schema.properties?.[indexed]) sql.push(`create index if not exists "${table}_${indexed}_idx" on public."${table}" ("${indexed}");`);
  }
}
process.stdout.write(sql.join('\n\n'));
