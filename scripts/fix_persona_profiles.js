// Applies the same corrections I made to profiles/defaults/_default.json to the
// persona profiles (joe/dave/pete/sam/sarah) and the crafting task profile, while
// preserving each bot's persona flavor (nicknames, character voice). It only
// touches the broken substrings: invalid command names, parser-rejected single
// quotes / nested quotes, and wrong output envelopes.
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
    'joe.json',
    'dave.json',
    'pete.json',
    'sam.json',
    'sarah.json',
    'profiles/tasks/crafting_profile.json',
];

// Command name corrections (exact call-name renames).
const NAME_RENAMES = [
    [/\bcraftItem\b/g, 'craftRecipe'],
    [/\bcollectBlock\b(?!s)/g, 'collectBlocks'],
];

// Parse a command argument list like:  "stone", 64   or   'stone', 64
// Toggles quote state on ANY quote char so nested decorative quotes (e.g. the
// nickname in "Hey "Daring" Dave!") don't prematurely close the string. The
// decorative quotes are then stripped, leaving a clean double-quoted arg.
const isWord = (c) => !!c && /[A-Za-z0-9]/.test(c);

function parseArgs(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
        while (i < s.length && (s[i] === ' ' || s[i] === ',')) i++;
        if (i >= s.length) break;
        if (s[i] === '"' || s[i] === "'") {
            let j = i + 1;
            let val = '';
            let inQuote = true;
            while (j < s.length) {
                const c = s[j];
                // An apostrophe between two word chars is a contraction (Let's),
                // not a delimiter. Keep it literal.
                if (c === "'" && inQuote && isWord(s[j - 1]) && isWord(s[j + 1])) {
                    val += c; j++; continue;
                }
                if (c === '"' || c === "'") { inQuote = !inQuote; j++; continue; }
                if (c === ',' && !inQuote) break;
                val += c;
                j++;
            }
            toks.push({ type: 'str', val });
            i = j;
        } else {
            let j = i;
            while (j < s.length && s[j] !== ',') j++;
            toks.push({ type: 'raw', val: s.slice(i, j).trim() });
            i = j;
        }
    }
    return toks;
}

function normalizeCommandCall(name, argsStr) {
    let newName = name;
    for (const [re, rep] of NAME_RENAMES) newName = newName.replace(re, rep);
    if (argsStr === null) return '!' + newName;
    let toks = parseArgs(argsStr);
    // If an unquoted segment contains spaces it is free-text (e.g. an unquoted
    // message). Merge that segment and everything after it into one string arg.
    const firstRaw = toks.findIndex(t => t.type === 'raw' && /\s/.test(t.val));
    if (firstRaw !== -1) {
        const head = toks.slice(0, firstRaw);
        const merged = toks.slice(firstRaw).map(t => t.val).join(', ');
        toks = [...head, { type: 'str', val: merged }];
    }
    const out = toks.map(t => {
        if (t.type === 'str') return '"' + t.val.replace(/"/g, '') + '"';
        return t.val;
    });
    // followPlayer requires a follow_dist arg; default to 4 when missing.
    if (newName === 'followPlayer' && out.length === 1) out.push('4');
    return '!' + newName + '(' + out.join(', ') + ')';
}

// Rewrite every !command(...) inside a content string.
function normalizeCommands(content) {
    return content.replace(/!(\w+)(?:\(([^()]*)\))?/g, (m, name, args) =>
        normalizeCommandCall(name, args === undefined ? null : args)
    );
}

// Exact system-message envelope corrections. NOTE: these match the PARSED content
// (real newlines), not the JSON source form.
const ENVELOPE_MAP = [
    ['Image analysis:\nLooking at player justoboy13. There is a giant waterfall behind justoboy13.',
     'Looking at player justoboy13\nImage analysis: "There is a giant waterfall behind justoboy13."'],
    ['Image analysis:\nLooking at position 0, 70, 12. There is a water fountain.',
     'Looking at coordinate 0, 70, 12\nImage analysis: "There is a water fountain."'],
    ['Code Output:\nYou have crafted 4 spruce_planks.\nCode execution finished successfully.',
     'Action output:\nSuccessfully crafted spruce_planks, you now have 4 spruce_planks.'],
    ['Code Output:\nYou have crafted 16 sticks.\nCode execution finished successfully.',
     'Action output:\nSuccessfully crafted stick, you now have 16 stick.'],
    ['Arrived at player.', 'Action output:\nYou have reached justoboy13.'],
    ['Code Output:\nNo zombie nearby', 'Action output:\nCould not find any zombie to attack.'],
    ['Agent action stopped.', 'Agent stopped.'],
    ['Code output: Action failed.', 'Action output:\nAction failed.'],
    ['Code output: Could not find any oak_log in 20 blocks.',
     'Action output:\nCould not find any oak_log in 32 blocks.'],
    ['Code output: Placed oak_planks at (-154, 96, -228).',
     'Action output:\nPlaced oak_planks at (-154, 96, -228).'],
    ["'hunting' mode disabled.", 'Mode hunting is now off.'],
];

function fixSystemContent(content) {
    let out = content;
    for (const [from, to] of ENVELOPE_MAP) out = out.split(from).join(to);
    // self-prompt trigger messages must state the command requirement
    out = out.replace(/\. Respond:$/, '. Your next response MUST contain a command with this syntax: !commandName. Respond:');
    return out;
}

// Merge an assistant code turn + the following system result turn into the real
// coder envelope, matching _default.json's corrected coding_examples.
function fixCodingExample(example) {
    const result = [];
    for (let i = 0; i < example.length; i++) {
        const turn = example[i];
        if (turn.role === 'assistant' && turn.content.startsWith('```')) {
            const code = turn.content;
            const next = example[i + 1];
            if (next && next.role === 'system') {
                let res = next.content;
                // normalize old result wording to the inner Action output line
                res = res
                    .replace(/^Code output:\n!!Code threw exception!!\s+Error: /, '')
                    .replace(/\n Write code to fix the problem and try again\.$/, '\n Please try again:')
                    .replace(/^Code execution finished successfully\.$/, 'Action output:\nYou have reached justoboy13.')
                    .replace(/^Successfully collected 9 wood\.$/, 'Action output:\nCollected 9 oak_log.')
                    .replace(/^Successfully smelted 8 chicken into 8 cooked_chicken\.$/, 'Action output:\nSuccessfully smelted chicken, got 8 cooked_chicken.')
                    .replace(/^Arrived at location\.$/, 'Action output:\nYou have reached at 12, 70, 34.')
                    .replace(/^Successfully placed 5 dirt\.$/, 'Action output:\nPlaced dirt at (12, 70, 34).');
                if (res.startsWith('!!Code threw exception') || res.includes('ReferenceError')) {
                    result.push({ role: 'system', content: 'Code Output:\n' + res });
                } else {
                    result.push({ role: 'system', content: 'Agent wrote this code: \n' + code + '\nCode Output:\n' + res });
                }
                i++; // consume the system turn we merged
                continue;
            }
            result.push(turn);
            continue;
        }
        result.push(turn);
    }
    return result;
}

for (const rel of files) {
    const obj = JSON.parse(readFileSync(rel, 'utf8'));
    if (Array.isArray(obj.conversation_examples)) {
        obj.conversation_examples = obj.conversation_examples.map(example =>
            example.map(turn => {
                if (turn.role === 'assistant') return { role: 'assistant', content: normalizeCommands(turn.content) };
                if (turn.role === 'system') return { role: 'system', content: fixSystemContent(turn.content) };
                return turn;
            })
        );
    }
    if (Array.isArray(obj.coding_examples)) {
        obj.coding_examples = obj.coding_examples.map(fixCodingExample);
    }
    writeFileSync(rel, JSON.stringify(obj, null, 4) + '\n', 'utf8');
    console.log('[fixed] ' + rel);
}
console.log('Done.');
