'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseGuide, auditGuide } = require('../tools/lib/audit/guide');

test('parses class-only steps, quest ids, optional goals and source lines', () => {
  const s = parseGuide('step Seer Ravenfeather\n  only Shaman\n  accept 1519\nstep Salve\n  collect 6634 quest 1519.1\n  collect 99 quest 1519.2 optional\n');
  assert.equal(s[0].only, 'Shaman');
  assert.equal(s[0].goals[0].quest, 1519);
  assert.equal(s[1].goals[0].quest, 1519);
  assert.equal(s[1].goals[1].optional, true);
  assert.equal(s[1].goals[0].line, 5);
});

test('flags Mulgore Call of Earth possible revisiting after acceptance', () => {
  const filename = path.join(__dirname, '../guides/forever/horde/tauren/01-mulgore.guide');
  const findings = auditGuide(fs.readFileSync(filename, 'utf8'), filename);
  const match = findings.find(f => f.rule === 'possible-return-to-objective-area'
    && f.quest === 1519 && f.location === 'Brambleblade Ravine');
  assert.ok(match, 'should notice the visit to Brambleblade Ravine before accepting Call of Earth');
  assert.ok(match.previousVisitLine < match.questAcceptedLine);
  assert.ok(match.questAcceptedLine < match.line);
});

test('flags Mazzranache multi-item farming location as unverified', () => {
  const filename = path.join(__dirname, '../guides/forever/horde/tauren/01-mulgore.guide');
  const findings = auditGuide(fs.readFileSync(filename, 'utf8'), filename);
  const match = findings.find(f => f.rule === 'multi-item-farm-without-coordinates'
    && f.quest === 766 && f.location === 'Mazzranache');
  assert.ok(match);
  assert.deepEqual(match.items, [4804, 4805, 4806, 4807]);
  assert.equal(match.confidence, 'low');
});

test('does not label already-accepted quest as a late acceptance', () => {
  const guide = 'step Start\n  accept 1519\nstep Brambleblade Ravine\n  kill 999 quest 1.1\nstep Later\n  tip Back to Brambleblade Ravine\n  collect 6634 quest 1519.1\n';
  assert.equal(auditGuide(guide).filter(f => f.rule === 'possible-return-to-objective-area').length, 0);
});

test('does not flag one multi-item farming step when coordinates are supplied', () => {
  const guide = 'step Farm\n  collect 100 quest 99.1 @10,20\n  collect 101 quest 99.2 @15,25\n  collect 102 quest 99.3 @18,22\n';
  assert.equal(auditGuide(guide).length, 0);
});
