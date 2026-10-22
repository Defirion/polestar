'use strict';

// Lightweight source-level triage. This is NOT Polestar's route simulator:
// a finding is a review candidate, never a claim of time saved.
function parseGuide(source) {
  const steps = [];
  const lines = source.split(/\r?\n/);
  for (const [index, original] of lines.entries()) {
    const line = original.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('step ')) {
      steps.push({ title: line.slice(5).trim(), line: index + 1, tips: [], goals: [], only: null });
      continue;
    }
    const step = steps[steps.length - 1];
    if (!step) continue;
    const clean = line.split(/\s--(?:\s|$)/)[0].trim();
    if (clean.startsWith('tip ')) {
      step.tips.push(clean.slice(4));
      continue;
    }
    if (clean.startsWith('only ')) {
      step.only = clean.slice(5);
      continue;
    }
    const match = /^(accept|turnin|collect|kill|complete|use)\s+(\d+)\b/.exec(clean);
    if (!match) continue;
    const action = match[1];
    const itemOrQuest = Number(match[2]);
    const questMatch = /\bquest\s+(\d+)(?:\.\d+)?\b/.exec(clean);
    const quest = questMatch ? Number(questMatch[1])
      : (action === 'accept' || action === 'turnin' || action === 'complete' ? itemOrQuest : null);
    step.goals.push({
      action, target: itemOrQuest, quest, line: index + 1,
      optional: /\boptional\b/.test(clean),
      hasCoordinate: /@\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?/.test(clean),
    });
  }
  return steps;
}

function auditGuide(source, guidePath = '(memory)') {
  const steps = parseGuide(source);
  const findings = [];
  for (let i = 0; i < steps.length; i++) {
    const current = steps[i];
    for (const goal of current.goals) {
      if (goal.action !== 'collect' || goal.quest === null || goal.optional) continue;
      // Only compare against a quest accepted earlier in this guide. If a
      // quest was already active on entry, we cannot infer an accept time.
      let acceptedIndex = -1;
      for (let j = i; j >= 0; j--) {
        if (steps[j].goals.some(g => g.action === 'accept' && g.quest === goal.quest
            && (j < i || g.line < goal.line))) {
          acceptedIndex = j;
          break;
        }
      }
      if (acceptedIndex < 0) continue;
      const description = current.tips.join(' ').toLowerCase();
      for (let j = Math.max(0, acceptedIndex - 30); j < acceptedIndex; j++) {
        const prior = steps[j];
        if (prior.title.length < 8 || prior.title.split(/\s+/).length < 2) continue;
        if (!description.includes(prior.title.toLowerCase())) continue;
        if (!prior.goals.some(g => ['collect', 'kill', 'use', 'complete'].includes(g.action))) continue;
        findings.push({
          rule: 'possible-return-to-objective-area',
          confidence: 'medium',
          guide: guidePath,
          quest: goal.quest,
          line: goal.line,
          location: prior.title,
          previousVisitLine: prior.line,
          questAcceptedLine: steps[acceptedIndex].goals.find(g => g.action === 'accept' && g.quest === goal.quest).line,
          description: 'A later collection step names a work site visited before the quest was accepted. Review level gates and possible shared farming.',
        });
        break;
      }
    }

    // A single step requiring several different items without per-item
    // coordinates deserves spawn-cluster verification. It may be perfectly
    // routed: this is a data-quality prompt, not a confirmed defect.
    const byQuest = new Map();
    for (const goal of current.goals) {
      if (goal.action !== 'collect' || goal.quest === null || goal.optional) continue;
      if (!byQuest.has(goal.quest)) byQuest.set(goal.quest, []);
      byQuest.get(goal.quest).push(goal);
    }
    for (const [quest, goals] of byQuest) {
      if (new Set(goals.map(g => g.target)).size < 3) continue;
      if (goals.some(g => g.hasCoordinate)) continue;
      findings.push({
        rule: 'multi-item-farm-without-coordinates',
        confidence: 'low',
        guide: guidePath,
        quest,
        line: goals[0].line,
        location: current.title,
        items: goals.map(g => g.target),
        description: 'Several required item sources share one unlocated step. Compare spawn clusters and routed walking costs before suggesting changes.',
      });
    }
  }
  // De-duplicate multiple objectives of the same quest and location.
  const seen = new Set();
  return findings.filter(f => {
    const key = [f.rule, f.guide, f.quest, f.location, f.previousVisitLine || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { parseGuide, auditGuide };
