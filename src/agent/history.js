import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { NPCData } from './npc/data.js';
import settings from './settings.js';

/**
 * Sanitize a user-supplied memory bucket name so it is safe to use as a single
 * filesystem path segment. Strips path separators and other characters that are
 * invalid or dangerous in a Windows/POSIX filename, collapses the result, and
 * guards against empty / '.' / '..' (path traversal) values.
 */
export function sanitizeMemoryName(raw) {
    if (typeof raw !== 'string') return null;
    // Strip anything that isn't a word char, dash, or dot. This removes '/',
    // '\', ':', and control chars, which neutralizes path traversal and invalid
    // filename characters on both Windows and POSIX.
    let cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '').replace(/^\.+/, '');
    if (cleaned === '' || cleaned === '.' || cleaned === '..') return null;
    return cleaned;
}

export class History {
    constructor(agent) {
        this.agent = agent;
        this.name = agent.name;
        // Memory is isolated per agent (by agent name) and scoped by the
        // (sanitized) memory bucket, so two agents never share or clobber one
        // file. A null bucket means memory is disabled for this agent.
        const bucket = sanitizeMemoryName(agent.memory_name);
        this.memory_name = bucket;
        this.enabled = bucket !== null;
        this.memory_fp = path.join('bots', this.name, bucket || 'default', 'memory.json');
        this.full_history_fp = undefined;

        mkdirSync(path.join('bots', this.name, bucket || 'default', 'histories'), { recursive: true });

        this.turns = [];

        // Natural language memory as a summary of recent messages + previous memory
        this.memory = '';

        // Maximum number of messages to keep in context before saving chunk to memory
        this.max_messages = settings.max_messages;

        // Number of messages to remove from current history and save into memory
        this.summary_chunk_size = 5; 
        // chunking reduces expensive calls to promptMemSaving and appendFullHistory
        // and improves the quality of the memory summary
    }

    getHistory() { // expects an Examples object
        return JSON.parse(JSON.stringify(this.turns));
    }

    async summarizeMemories(turns) {
        console.log("Storing memories...");
        this.memory = await this.agent.prompter.promptMemSaving(turns);

        if (this.memory.length > 500) {
            this.memory = this.memory.slice(0, 500);
            this.memory += '...(Memory truncated to 500 chars. Compress it more next time)';
        }

        console.log("Memory updated to: ", this.memory);
    }

    async appendFullHistory(to_store) {
        if (!this.enabled) return;
        if (this.full_history_fp === undefined) {
            const string_timestamp = new Date().toLocaleString().replace(/[/:]/g, '-').replace(/ /g, '').replace(/,/g, '_');
            this.full_history_fp = path.join(path.dirname(this.memory_fp), 'histories', `${string_timestamp}.json`);
            mkdirSync(path.dirname(this.full_history_fp), { recursive: true });
            writeFileSync(this.full_history_fp, '[]', 'utf8');
        }
        try {
            const data = readFileSync(this.full_history_fp, 'utf8');
            let full_history = JSON.parse(data);
            full_history.push(...to_store);
            writeFileSync(this.full_history_fp, JSON.stringify(full_history, null, 4), 'utf8');
        } catch (err) {
            console.error(`Error reading ${this.name}'s full history file: ${err.message}`);
        }
    }

    async add(name, content) {
        let role = 'assistant';
        if (name === 'system') {
            role = 'system';
        }
        else if (name !== this.name) {
            role = 'user';
            content = `${name}: ${content}`;
        }
        this.turns.push({role, content});

        if (this.turns.length >= this.max_messages) {
            let chunk = this.turns.splice(0, this.summary_chunk_size);
            while (this.turns.length > 0 && this.turns[0].role === 'assistant')
                chunk.push(this.turns.shift()); // remove until turns starts with system/user message

            await this.summarizeMemories(chunk);
            await this.appendFullHistory(chunk);
        }
    }

    async save() {
        if (!this.enabled) return;
        try {
            const data = {
                memory: this.memory,
                turns: this.turns,
                self_prompting_state: this.agent.self_prompter.state,
                self_prompt: this.agent.self_prompter.isStopped() ? null : this.agent.self_prompter.prompt,
                taskStart: this.agent.task.taskStartTime,
                last_sender: this.agent.last_sender
            };
            writeFileSync(this.memory_fp, JSON.stringify(data, null, 2));
            console.log('Saved memory to:', this.memory_fp);
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    }

    load() {
        if (!this.enabled) return null;
        try {
            if (!existsSync(this.memory_fp)) {
                console.log('No memory file found.');
                return null;
            }
            const data = JSON.parse(readFileSync(this.memory_fp, 'utf8'));
            this.memory = data.memory || '';
            this.turns = data.turns || [];
            console.log('Loaded memory:', this.memory);
            return data;
        } catch (error) {
            console.error('Failed to load history:', error);
            throw error;
        }
    }

    clear() {
        this.turns = [];
        this.memory = '';
    }
}