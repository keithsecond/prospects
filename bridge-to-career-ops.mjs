#!/usr/bin/env node
/**
 * bridge-to-career-ops.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * Bridges keithsecond/prospects' `test-data/` datastores into
 * keithsecond/career-ops for evaluation.
 *
 * WHAT IT READS (prospects/test-data — read-only)
 *   - test-data/sites.json + test-data/filters.json
 *       Used to recreate the Utilities.ORGS / Utilities.URLS lookup maps
 *       (org name -> base career-site URL) without needing the TS toolchain.
 *   - test-data/jobResults.json
 *       The application tracker. `status: "0"` means "new job, not yet
 *       applied" (see Status Definitions in the file itself).
 *   - test-data/description/<org>.description.json
 *       Full scraped job-description text, keyed by the same numeric
 *       `URL entity` id that jobResults.json uses as `job.id`.
 *
 * WHAT IT WRITES (career-ops — the consuming project)
 *   - career-ops/jds/<org-slug>-<entityId>.md
 *       Cleaned, decoded JD text ready for evaluation.
 *   - career-ops/data/pipeline.md
 *       Appends `- [ ] local:jds/<file>.md | <Org> | <Title>` lines to the
 *       "## Pending" section (the documented "Second Brain" URL inbox —
 *       see modes/pipeline.md, "`local:` prefix: Read the local file").
 *       Run `/career-ops pipeline` in career-ops to evaluate everything.
 *
 * WHAT IT WRITES BACK (prospects/test-data)
 *   - test-data/.bridge-state.json
 *       Idempotency ledger: `org::entityId -> { bridgedAt, file }`.
 *       Prevents re-bridging the same posting on every run.
 *   - test-data/jobResults.json (only for postings career-ops has never
 *       seen at all — i.e. they don't exist under ANY status yet). These
 *       are registered with `status: "0"` using the same shape produced by
 *       classes/utilities.ts's `normalizeJobs()`, so a later Playwright run
 *       won't re-discover them as "new" either. Disable with
 *       --no-update-job-results.
 *
 * USAGE
 *   node bridge-to-career-ops.mjs [options]
 *
 * OPTIONS
 *   --prospects-root <dir>     Path to the prospects repo (default: ".")
 *   --career-ops-root <dir>    Path to the career-ops repo (default: "../career-ops")
 *   --target <pipeline|batch>  Output format (default: "pipeline")
 *   --org "<name>"             Only process this org (repeatable)
 *   --limit <n>                Bridge at most n postings this run
 *   --dry-run                  Compute and print everything, write nothing
 *   --no-update-job-results    Don't register brand-new postings in jobResults.json
 *   --reset-state              Ignore (and overwrite) the bridge-state ledger
 *   --help                     Show this help
 * ─────────────────────────────────────────────────────────────────────────
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// ───────────────────────────────────────────────────────────────────────
// CLI ARGUMENTS
// ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    prospectsRoot: '.',
    careerOpsRoot: '../career-ops',
    target: 'pipeline',
    orgs: [],
    limit: Infinity,
    dryRun: false,
    updateJobResults: true,
    resetState: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--prospects-root':
        opts.prospectsRoot = argv[++i];
        break;
      case '--career-ops-root':
        opts.careerOpsRoot = argv[++i];
        break;
      case '--target':
        opts.target = argv[++i];
        break;
      case '--org':
        opts.orgs.push(argv[++i]);
        break;
      case '--limit':
        opts.limit = parseInt(argv[++i], 10);
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--no-update-job-results':
        opts.updateJobResults = false;
        break;
      case '--reset-state':
        opts.resetState = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        console.warn(`⚠️  Unknown argument: ${a}`);
    }
  }

  if (!['pipeline', 'batch'].includes(opts.target)) {
    console.error(`❌  Invalid --target "${opts.target}" (expected "pipeline" or "batch")`);
    process.exit(1);
  }

  return opts;
}

function printHelp() {
  console.log(`
bridge-to-career-ops.mjs

Bridges prospects/test-data (description/*.description.json + jobResults.json)
into career-ops for A-G evaluation.

USAGE
  node bridge-to-career-ops.mjs [options]

OPTIONS
  --prospects-root <dir>     Path to the prospects repo (default: ".")
  --career-ops-root <dir>    Path to the career-ops repo (default: "../career-ops")
  --target <pipeline|batch>  Output format (default: "pipeline")
  --org "<name>"             Only process this org (repeatable)
  --limit <n>                Bridge at most n postings this run
  --dry-run                  Compute and print everything, write nothing
  --no-update-job-results    Don't register brand-new postings in jobResults.json
  --reset-state              Ignore (and overwrite) the bridge-state ledger
  --help                     Show this help

EXAMPLES
  node bridge-to-career-ops.mjs --dry-run
  node bridge-to-career-ops.mjs --career-ops-root ~/code/career-ops
  node bridge-to-career-ops.mjs --org "Houston ISD" --limit 5
`);
}

// ───────────────────────────────────────────────────────────────────────
// HTML ENTITY DECODING / TEXT CLEANUP
// (description JSON comes straight from scraped HTML — &rsquo; etc. and
//  \r\n soup throughout)
// ───────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201D', ldquo: '\u201C',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026',
  trade: '\u2122', copy: '\u00A9', reg: '\u00AE', deg: '\u00B0',
  eacute: '\u00E9', egrave: '\u00E8', agrave: '\u00E0', ouml: '\u00F6',
  uuml: '\u00FC', auml: '\u00E4', ntilde: '\u00F1', middot: '\u00B7',
  bull: '\u2022', sect: '\u00A7',
};

function decodeEntities(str) {
  return String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function cleanDescription(raw) {
  let text = decodeEntities(raw ?? '');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

// ───────────────────────────────────────────────────────────────────────
// SITE / ORG LOOKUP MAPS
// Mirrors classes/utilities.ts (Utilities.ORGS / Utilities.URLS) without
// requiring the TypeScript toolchain.
// ───────────────────────────────────────────────────────────────────────

async function loadJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function loadSiteMaps(testDataDir) {
  const sites = await loadJson(path.join(testDataDir, 'sites.json'), {});
  const filters = await loadJson(path.join(testDataDir, 'filters.json'), {});

  const allSites = [
    ...(sites.Private || []),
    ...(sites.Public || []),
    ...(sites.Universities || []),
    ...(sites.Sites || []),
    ...(sites.Recruiters || []),
    ...(sites.Employers || []),
  ];

  const allEightfold = Object.values(filters || {});

  const orgToBaseUrl = new Map();
  for (const s of allSites) {
    if (s.org && s.URL && !orgToBaseUrl.has(s.org)) orgToBaseUrl.set(s.org, s.URL);
  }
  for (const f of allEightfold) {
    if (f.org && f.baseUrl && !orgToBaseUrl.has(f.org)) orgToBaseUrl.set(f.org, f.baseUrl);
  }

  return { orgToBaseUrl };
}

// ───────────────────────────────────────────────────────────────────────
// LINK CONSTRUCTION
// career sites use wildly different deep-link formats per ATS provider
// (SchoolSpring: ?jobid=N · ADP: &selectedMenuKey=...&jobId=N · Eightfold:
// /careers?pid=N or /careerhub/explore/jobs/N). Rather than guess, we reuse
// a *sibling job's actual link from jobResults.json for the same org* as a
// template and substitute in the new entity id — this is empirically
// correct for that org because it's a real link prospects already recorded.
// Falls back to the org's base career-site URL if no sibling link exists.
// ───────────────────────────────────────────────────────────────────────

function buildLink(org, entityId, jobResultsOrgEntry, orgToBaseUrl) {
  const jobs = jobResultsOrgEntry?.jobs || [];
  for (const j of jobs) {
    if (j.link && j.id && j.link.includes(String(j.id))) {
      return j.link.split(String(j.id)).join(String(entityId));
    }
  }
  return orgToBaseUrl.get(org) || '';
}

// ───────────────────────────────────────────────────────────────────────
// DESCRIPTION FILES
// ───────────────────────────────────────────────────────────────────────

async function loadDescriptions(testDataDir) {
  const dir = path.join(testDataDir, 'description');
  let files = [];
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.json'));
  } catch {
    return new Map(); // no description/ directory
  }

  // org -> Map(entityId -> { title, JobID, Department, Description })
  const byOrg = new Map();
  for (const file of files) {
    const data = await loadJson(path.join(dir, file), {});
    for (const [org, entry] of Object.entries(data)) {
      const jobs = entry?.jobs || [];
      const entityMap = byOrg.get(org) || new Map();
      for (const job of jobs) {
        const entityId = String(job['URL entity'] ?? '');
        if (!entityId) continue;
        // First one wins if duplicates exist in source data
        if (!entityMap.has(entityId)) entityMap.set(entityId, job);
      }
      byOrg.set(org, entityMap);
    }
  }
  return byOrg;
}

// ───────────────────────────────────────────────────────────────────────
// BRIDGE STATE (idempotency ledger)
// ───────────────────────────────────────────────────────────────────────

async function loadState(statePath, reset) {
  if (reset) return {};
  return (await loadJson(statePath, {})) || {};
}

// ───────────────────────────────────────────────────────────────────────
// BUILD THE "TO BRIDGE" QUEUE
// ───────────────────────────────────────────────────────────────────────

function buildQueue({ jobResults, descByOrg, state, orgToBaseUrl, orgFilter }) {
  const queue = [];
  const newJobResultsEntries = []; // { org, job } to register with status "0"

  const orgs = Object.keys(jobResults).filter(k => k !== 'Status Definitions');

  // 1. Tracked jobs with status "0" ("new job, not yet applied") — these
  //    are candidates the user hasn't acted on yet and benefit from a
  //    career-ops evaluation before they decide whether to apply.
  for (const org of orgs) {
    if (orgFilter.length && !orgFilter.includes(org)) continue;
    const entry = jobResults[org];
    for (const job of entry.jobs || []) {
      if (String(job.status) !== '0') continue;
      const key = `${org}::${job.id}`;
      if (state[key]) continue;

      const jd = descByOrg.get(org)?.get(String(job.id)) || null;
      queue.push({
        org,
        entityId: String(job.id),
        title: job.title,
        link: job.link || buildLink(org, job.id, entry, orgToBaseUrl),
        department: jd?.Department,
        description: jd?.Description,
        source: 'tracked-new',
        registersJobResult: false,
      });
    }
  }

  // 2. Postings present in description/*.description.json that don't exist
  //    under ANY status in jobResults.json yet — i.e. genuinely new finds
  //    that haven't been triaged at all. Feed these to career-ops AND
  //    register them in jobResults.json (status "0"), mirroring
  //    Utilities.normalizeJobs().
  for (const [org, entityMap] of descByOrg.entries()) {
    if (orgFilter.length && !orgFilter.includes(org)) continue;
    const trackedIds = new Set((jobResults[org]?.jobs || []).map(j => String(j.id)));
    for (const [entityId, jd] of entityMap.entries()) {
      if (trackedIds.has(entityId)) continue;
      const key = `${org}::${entityId}`;
      if (state[key]) continue;

      const link = buildLink(org, entityId, jobResults[org], orgToBaseUrl);
      queue.push({
        org,
        entityId,
        title: jd.title,
        link,
        department: jd.Department,
        description: jd.Description,
        source: 'untracked-new',
        registersJobResult: true,
      });
    }
  }

  return queue;
}

// ───────────────────────────────────────────────────────────────────────
// OUTPUT WRITERS
// ───────────────────────────────────────────────────────────────────────

function buildJdMarkdown(item, today) {
  const lines = [];
  lines.push(`# ${item.title || 'Untitled posting'}`);
  lines.push('');
  lines.push(`**Company:** ${item.org}`);
  if (item.department && String(item.department).trim()) {
    lines.push(`**Department:** ${String(item.department).trim()}`);
  }
  if (item.link) lines.push(`**Source:** ${item.link}`);
  lines.push(`**Entity ID:** ${item.entityId}`);
  lines.push(`**Bridged:** ${today} via prospects/test-data`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(item.description ? cleanDescription(item.description) : '_No JD text was available from the scraper for this posting — verify against the Source URL above._');
  lines.push('');
  return lines.join('\n');
}

async function appendToPipelineMd(pipelineMdPath, newLines, dryRun) {
  let content = await readFile(pipelineMdPath, 'utf-8').catch(() => null);
  if (content === null) {
    content = '# Job URL Inbox\n\n## Pending\n\n## Processed\n';
  }

  // Avoid duplicate entries on repeat runs
  const linesToAdd = newLines.filter(line => !content.includes(line.trim()));
  if (linesToAdd.length === 0) return content;

  const lines = content.split('\n');
  let pendingIdx = lines.findIndex(l => l.trim().toLowerCase() === '## pending');
  if (pendingIdx === -1) {
    // No Pending section — create one at the top
    lines.unshift('## Pending', '');
    pendingIdx = 0;
  }

  // Find the next section header after "## Pending" (or end of file)
  let insertAt = lines.length;
  for (let i = pendingIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  // Walk back over trailing blank lines so new entries sit right under
  // the existing pending list (not after a gap)
  while (insertAt > pendingIdx + 1 && lines[insertAt - 1].trim() === '') {
    insertAt--;
  }

  lines.splice(insertAt, 0, ...linesToAdd);
  const updated = lines.join('\n');

  if (!dryRun) await writeFile(pipelineMdPath, updated, 'utf-8');
  return updated;
}

async function appendToBatchTsv(batchTsvPath, rows, dryRun) {
  let content = await readFile(batchTsvPath, 'utf-8').catch(() => null);
  let nextId = 1;
  if (content === null) {
    content = 'id\turl\tsource\tnotes\n';
  } else {
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const id = parseInt(line.split('\t')[0], 10);
      if (!isNaN(id) && id >= nextId) nextId = id + 1;
    }
  }

  const linesToAdd = [];
  for (const row of rows) {
    if (content.includes(`\t${row.notes}`)) continue; // dedup on notes text
    linesToAdd.push(`${nextId}\t${row.url}\t${row.source}\t${row.notes}`);
    nextId++;
  }
  if (linesToAdd.length === 0) return content;

  const updated = content.replace(/\n?$/, '\n') + linesToAdd.join('\n') + '\n';
  if (!dryRun) await writeFile(batchTsvPath, updated, 'utf-8');
  return updated;
}

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const testDataDir = path.join(opts.prospectsRoot, 'test-data');
  const careerOpsDir = opts.careerOpsRoot;
  const statePath = path.join(testDataDir, '.bridge-state.json');
  const jobResultsPath = path.join(testDataDir, 'jobResults.json');

  if (!existsSync(testDataDir)) {
    console.error(`❌  test-data directory not found at: ${testDataDir}`);
    console.error('    Pass --prospects-root pointing at the prospects repo checkout.');
    process.exit(1);
  }
  if (!existsSync(careerOpsDir)) {
    console.error(`❌  career-ops directory not found at: ${careerOpsDir}`);
    console.error('    Pass --career-ops-root pointing at the career-ops repo checkout.');
    process.exit(1);
  }

  console.log('📂  Loading prospects/test-data...');
  const { orgToBaseUrl } = await loadSiteMaps(testDataDir);
  const jobResults = await loadJson(jobResultsPath, {});
  const descByOrg = await loadDescriptions(testDataDir);
  const state = await loadState(statePath, opts.resetState);

  const queue = buildQueue({ jobResults, descByOrg, state, orgToBaseUrl, orgFilter: opts.orgs });
  const limited = queue.slice(0, opts.limit);

  console.log(`🔎  Found ${queue.length} posting(s) ready to bridge` +
    (limited.length < queue.length ? ` (processing ${limited.length} due to --limit)` : '') + '.');

  if (limited.length === 0) {
    console.log('✅  Nothing new to bridge. (Everything already evaluated or already bridged.)');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const jdsDir = path.join(careerOpsDir, 'jds');
  const pipelineMdPath = path.join(careerOpsDir, 'data', 'pipeline.md');
  const batchTsvPath = path.join(careerOpsDir, 'batch', 'batch-input.tsv');

  if (!opts.dryRun) {
    await mkdir(jdsDir, { recursive: true });
    await mkdir(path.dirname(pipelineMdPath), { recursive: true });
  }

  const pendingLines = [];
  const batchRows = [];
  const summary = [];

  for (const item of limited) {
    const slug = `${slugify(item.org)}-${item.entityId}`;
    const filename = `${slug}.md`;
    const jdRelPath = `jds/${filename}`;
    const hasJd = !!item.description;

    if (opts.dryRun) {
      console.log(`\n— ${item.org}: "${item.title}" (entity ${item.entityId}) [${item.source}]`);
      console.log(`   would write: career-ops/${jdRelPath} (${hasJd ? 'JD text available' : 'NO JD text — link only'})`);
    } else {
      const md = buildJdMarkdown(item, today);
      await writeFile(path.join(jdsDir, filename), md, 'utf-8');
    }

    if (opts.target === 'pipeline') {
      const ref = hasJd ? `local:${jdRelPath}` : (item.link || `local:${jdRelPath}`);
      const noteSuffix = hasJd ? '' : ' — JD text unavailable, needs extraction from Source URL';
      pendingLines.push(`- [ ] ${ref} | ${item.org} | ${item.title}${noteSuffix}`);
    } else {
      batchRows.push({
        url: item.link || `local:${jdRelPath}`,
        source: item.org,
        notes: `${item.title} @ ${item.org} | ${item.link || ('local:' + jdRelPath)}`,
      });
    }

    summary.push(item);

    // Track state + jobResults registration
    state[`${item.org}::${item.entityId}`] = { bridgedAt: today, file: jdRelPath };
    if (item.registersJobResult && opts.updateJobResults) {
      if (!jobResults[item.org]) {
        jobResults[item.org] = { Site: item.org, URL: orgToBaseUrl.get(item.org) || '', jobs: [] };
      }
      if (!Array.isArray(jobResults[item.org].jobs)) jobResults[item.org].jobs = [];
      const already = jobResults[item.org].jobs.some(j => String(j.id) === item.entityId);
      if (!already) {
        jobResults[item.org].jobs.push({
          id: item.entityId,
          title: item.title,
          link: item.link || '',
          status: '0',
          date: today,
          notes: '',
        });
      }
    }
  }

  if (opts.target === 'pipeline' && pendingLines.length) {
    await appendToPipelineMd(pipelineMdPath, pendingLines, opts.dryRun);
    if (opts.dryRun) {
      console.log('\n— career-ops/data/pipeline.md would gain:');
      for (const l of pendingLines) console.log('   ' + l);
    } else {
      console.log(`📝  Updated career-ops/data/pipeline.md (+${pendingLines.length} pending entr${pendingLines.length === 1 ? 'y' : 'ies'})`);
    }
  } else if (opts.target === 'batch' && batchRows.length) {
    await appendToBatchTsv(batchTsvPath, batchRows, opts.dryRun);
    if (opts.dryRun) {
      console.log('\n— career-ops/batch/batch-input.tsv would gain:');
      for (const r of batchRows) console.log(`   ${r.url}\t${r.source}\t${r.notes}`);
    } else {
      console.log(`📝  Updated career-ops/batch/batch-input.tsv (+${batchRows.length} row(s))`);
    }
  }

  if (!opts.dryRun) {
    await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
    console.log(`📌  Updated ${path.relative('.', statePath)}`);

    if (opts.updateJobResults && limited.some(i => i.registersJobResult)) {
      await writeFile(jobResultsPath, JSON.stringify(jobResults, null, 2), 'utf-8');
      console.log(`📌  Registered new posting(s) in ${path.relative('.', jobResultsPath)} (status "0")`);
    }
  }

  console.log('\n' + '─'.repeat(72));
  console.log('  Bridged postings:');
  console.log('─'.repeat(72));
  for (const item of summary) {
    console.log(`  ${item.org.padEnd(28)} | ${item.title.slice(0, 45).padEnd(45)} | ${item.source}`);
  }
  console.log('─'.repeat(72));

  if (opts.target === 'pipeline') {
    console.log(`\n→ Next: cd ${careerOpsDir} && run /career-ops pipeline to evaluate ${summary.length} posting(s).`);
  } else {
    console.log(`\n→ Next: cd ${careerOpsDir} && run ./batch/batch-runner.sh to evaluate ${summary.length} posting(s).`);
  }

  if (opts.dryRun) {
    console.log('\n(dry run — no files were written. Re-run without --dry-run to apply.)');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
