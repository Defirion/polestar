#!/usr/bin/env node
'use strict';

// Read-only proof-of-concept. No game data build or simulator output needed.
const fs = require('node:fs');
const path = require('node:path');
const { auditGuide } = require('./lib/audit/guide');

const root = path.resolve(__dirname, '..');
const usage = 'Usage: node tools/route-audit.js --guide guides/forever/horde/tauren/01-mulgore.guide [--json]\n'
  + '       node tools/route-audit.js --all [--json]\n';
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() && file.endsWith('.guide') ? [file] : [];
  });
}
function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage);
    return 0;
  }
  const json = args.includes('--json');
  const all = args.includes('--all');
  const idx = args.indexOf('--guide');
  if ((all && idx !== -1) || (!all && idx === -1) || (idx !== -1 && !args[idx + 1])) {
    process.stderr.write(usage);
    return 2;
  }
  const paths = all ? walk(path.join(root, 'guides', 'forever'))
    : [path.resolve(root, args[idx + 1])];
  const findings = [];
  for (const file of paths.sort()) {
    if (!fs.statSync(file).isFile()) throw new Error('Not a regular file: ' + file);
    const relative = path.relative(root, file).split(path.sep).join('/');
    findings.push(...auditGuide(fs.readFileSync(file, 'utf8'), relative));
  }
  const report = {
    schemaVersion: 1,
    scanned: paths.length,
    findings,
    caveat: 'Heuristics only. No path lengths, XP deltas, spawn verification, or simulated savings are asserted.',
  };
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    process.stdout.write('Scanned ' + paths.length + ' guide(s); ' + findings.length + ' review candidate(s).\n');
    for (const f of findings) {
      process.stdout.write(f.guide + ':' + f.line + ' [' + f.rule + '] quest ' + f.quest
        + ' at ' + f.location + ' (' + f.confidence + ' confidence)\n');
    }
    process.stdout.write(report.caveat + '\n');
  }
  return 0;
}
if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('route-audit: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
module.exports = { main };
