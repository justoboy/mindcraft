import { getCommand } from '../src/agent/commands/index.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Same regex as src/agent/commands/index.js commandRegex
const commandRegex = /!(\w+)(?:\(((?:-?\d+(?:\.\d+)?|true|false|"[^"]*")(?:\s*,\s*(?:-?\d+(?:\.\d+)?|true|false|"[^"]*"))*)\))?/g;
const argRegex = /-?\d+(?:\.\d+)?|true|false|"[^"]*"/g;

function findJsonFiles(dir, acc = []) {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.git') continue;
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) findJsonFiles(full, acc);
        else if (entry.endsWith('.json')) acc.push(full);
    }
    return acc;
}

function checkExampleArray(label, examples, problems) {
    if (!Array.isArray(examples)) return;
    for (const convo of examples) {
        if (!Array.isArray(convo)) continue;
        for (const turn of convo) {
            if (turn.role !== 'assistant') continue;
            let m;
            commandRegex.lastIndex = 0;
            while ((m = commandRegex.exec(turn.content)) !== null) {
                const name = '!' + m[1];
                const cmd = getCommand(name);
                if (!cmd) {
                    problems.push(`${label}: MISSING command ${name}`);
                    continue;
                }
                const params = cmd.params ? Object.keys(cmd.params).length : 0;
                const args = m[2] ? (m[2].match(argRegex) ?? []) : [];
                if (args.length !== params) {
                    problems.push(`${label}: ARGCOUNT ${name} example=${args.length} registry=${params} :: ${turn.content.slice(0, 80)}`);
                }
            }
        }
    }
}

const files = findJsonFiles(root);
let totalProblems = 0;
for (const f of files) {
    let data;
    try {
        data = JSON.parse(readFileSync(f, 'utf8'));
    } catch (e) {
        console.log(`[skip] ${path.relative(root, f)}: not valid JSON (${e.message})`);
        continue;
    }
    const rel = path.relative(root, f);
    const problems = [];
    checkExampleArray(`${rel} conversation_examples`, data.conversation_examples, problems);
    checkExampleArray(`${rel} coding_examples`, data.coding_examples, problems);
    if (problems.length) {
        console.log(`\n=== ${rel} ===`);
        for (const p of problems) { console.log('  ' + p); totalProblems++; }
    } else {
        console.log(`[ok] ${rel}`);
    }
}
console.log(`\nTOTAL PROBLEMS: ${totalProblems}`);
process.exit(totalProblems === 0 ? 0 : 1);
