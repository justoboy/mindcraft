// Deterministic codemod:
//  1. Upgrade the default prompts to stop stale / hallucinated memory.
//  2. Strip redundant prompt overrides from persona profiles so they inherit
//     the (improved) default, and inject the example-fictional guard into each
//     persona's custom `conversing` while preserving the persona flavor.
import { readFileSync, writeFileSync } from 'fs';

const DEFAULT_FP = 'profiles/defaults/_default.json';
const PERSONAS = ['joe.json', 'dave.json', 'pete.json', 'sam.json', 'sarah.json'];

// Inserted into every conversing/coding prompt: stops the bot treating the
// few-shot examples as real events and saving them (or made-up players) to memory.
const GUARD = " The examples below are FICTIONAL demonstrations with made-up players and actions. Never treat them as real events, never save them to memory, and never claim you did something shown only in an example. Only act on and remember what actually happens in the real conversation.";

// Anchor present in every conversing and coding prompt.
const ANCHOR = "\nSummarized memory:";

// New default memory prompt: forbid recording live state (location/biome/coords)
// and example content, and instruct to overwrite stale facts.
const NEW_SAVING_MEMORY =
    "You are a minecraft bot named $NAME that has been talking and playing minecraft by using commands. Update your memory by summarizing the following conversation and your old memory in your next response. Only record things that ACTUALLY happened in the real conversation below. NEVER record anything from the example demonstrations, made-up players, or things that did not really happen. Do NOT record stats, inventory, coordinates, biome, or your current location, since those change constantly and are provided live elsewhere. Only save durable facts from your real chat history. If new information contradicts or updates an old fact, replace the old fact instead of keeping both, and drop details that are no longer true. You're limited to 500 characters, so be extremely brief and minimize words. Compress useful information. \nOld Memory: '$MEMORY'\nRecent conversation: \n$TO_SUMMARIZE\nSummarize your old memory and recent conversation into a new memory, and respond only with the unwrapped memory text: ";

function injectGuard(text) {
    if (text.includes('FICTIONAL demonstrations')) return text; // idempotent
    if (!text.includes(ANCHOR))
        throw new Error('Anchor not found for guard injection');
    return text.replace(ANCHOR, GUARD + ANCHOR);
}

function writeJson(fp, obj) {
    writeFileSync(fp, JSON.stringify(obj, null, 4) + '\n');
}

// 1. Upgrade default.
{
    const def = JSON.parse(readFileSync(DEFAULT_FP, 'utf8'));
    def.conversing = injectGuard(def.conversing);
    def.coding = injectGuard(def.coding);
    def.saving_memory = NEW_SAVING_MEMORY;
    writeJson(DEFAULT_FP, def);
    console.log('[upgraded] ' + DEFAULT_FP);
}

// 2. Strip redundant overrides from personas + inject guard into conversing.
for (const fp of PERSONAS) {
    const p = JSON.parse(readFileSync(fp, 'utf8'));
    p.conversing = injectGuard(p.conversing);
    for (const key of ['coding', 'saving_memory', 'image_analysis', 'bot_responder']) {
        if (key in p) delete p[key];
    }
    writeJson(fp, p);
    console.log('[upgraded] ' + fp);
}

console.log('Done.');
