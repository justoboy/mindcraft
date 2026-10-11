// Codemod: replace hardcoded fake player handles in example turns with the
// $PLAYER / $OTHER_BOT placeholders so examples teach real names at runtime.
//
// A handle is the text before the first ": " in a user turn. If that turn (or any
// turn by the same handle) contains "(FROM OTHER BOT)", the handle is another agent
// -> $OTHER_BOT. Otherwise it's a human player -> $PLAYER.
//
// Usage: node scripts/templatize_examples.js [path/to/profile.json ...]
// Defaults to profiles/defaults/_default.json when no args are given.

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targets = process.argv.slice(2);
if (targets.length === 0)
    targets.push(path.join(__dirname, '../profiles/defaults/_default.json'));

// Handles that are clearly NOT player/bot names and must never be templatized.
const RESERVED = new Set(['system', 'user', 'assistant', 'Action output', 'NEARBY_BLOCKS', 'CRAFTABLE_ITEMS', 'Image analysis', 'Looking at']);

function handleOf(content) {
    const idx = content.indexOf(':');
    if (idx === -1) return null;
    const h = content.substring(0, idx).trim();
    if (!h || RESERVED.has(h)) return null;
    // A handle should look like a username (no spaces, reasonable length).
    if (/\s/.test(h) || h.length > 24) return null;
    return h;
}

function processFile(fp) {
    const profile = JSON.parse(readFileSync(fp, 'utf8'));
    let changed = 0;

    for (const key of ['conversation_examples', 'coding_examples']) {
        const examples = profile[key];
        if (!Array.isArray(examples)) continue;
        for (const example of examples) {
            // Determine each handle's type within this example.
            const handleType = {};
            for (const turn of example) {
                if (turn.role !== 'user') continue;
                const h = handleOf(turn.content);
                if (!h) continue;
                const isOther = turn.content.includes('(FROM OTHER BOT)');
                // Once seen as other-bot, stays other-bot.
                if (handleType[h] === '$OTHER_BOT') continue;
                handleType[h] = isOther ? '$OTHER_BOT' : '$PLAYER';
            }
            // Replace every handle occurrence across all turns of this example.
            for (const turn of example) {
                let content = turn.content;
                for (const [h, ph] of Object.entries(handleType)) {
                    if (content.includes(h)) {
                        content = content.split(h).join(ph);
                        changed++;
                    }
                }
                turn.content = content;
            }
        }
    }

    if (changed > 0) {
        writeFileSync(fp, JSON.stringify(profile, null, 4));
        console.log(`[ok] ${path.basename(fp)}: templatized ${changed} handle occurrences`);
    } else {
        console.log(`[--] ${path.basename(fp)}: no changes`);
    }
}

for (const fp of targets) processFile(fp);
