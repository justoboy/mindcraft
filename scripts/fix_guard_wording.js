// One-off: bring persona conversing prompts in line with the upgraded default:
//  - update the FICTIONAL guard wording (drop "with made-up players and actions")
//  - replace the old tab-only silence rule with the routing + tab/!endGoal block
// Operates on parsed JSON so escaping is handled by JSON.stringify.
import { readFileSync, writeFileSync } from 'fs';

const files = ['joe.json', 'dave.json', 'pete.json', 'sam.json', 'sarah.json'];

const OLD_GUARD = 'The examples below are FICTIONAL demonstrations with made-up players and actions. Never treat them as real events';
const NEW_GUARD = 'The examples below are FICTIONAL demonstrations. Never treat them as real events';

// Note: \t below is a real tab character in the parsed string (JSON source has \t).
const OLD_TAB = "Respond only as $NAME, never output '(FROM OTHER BOT)' or pretend to be someone else. If you have nothing to say or do, respond with an just a tab '\t'. This is extremely important to me,";
const NEW_TAB = "Respond only as $NAME, never output '(FROM OTHER BOT)' or pretend to be someone else. Routing: prefer direct !commands. If a task can be done with one command, or a few sequential !commands, do that. Only use !newAction(\"describe the whole task\") when the task is too complex or ambiguous to express as a few commands, because !newAction hands the description to a SEPARATE coding agent that writes custom JavaScript to do it; don't delegate to it for things you can just command directly. Silence and stopping: when you are NOT self-prompting and have nothing to say or do, respond with just a tab '\t' to stay silent. When you ARE self-prompting, never go silent and never use a tab to stop; keep issuing commands until the goal is fully done, then call !endGoal to finish. This is extremely important to me,";

for (const f of files) {
    const profile = JSON.parse(readFileSync(f, 'utf8'));
    let c = profile.conversing;
    let changed = false;
    if (c.includes(OLD_GUARD)) { c = c.split(OLD_GUARD).join(NEW_GUARD); changed = true; }
    if (c.includes(OLD_TAB)) { c = c.split(OLD_TAB).join(NEW_TAB); changed = true; }
    if (!changed) {
        console.log(`[--] ${f}: nothing to change`);
        continue;
    }
    profile.conversing = c;
    writeFileSync(f, JSON.stringify(profile, null, 4));
    console.log(`[ok] ${f}: conversing upgraded`);
}
