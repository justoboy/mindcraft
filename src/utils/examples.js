import { cosineSimilarity } from './math.js';
import { stringifyTurns, wordOverlapScore } from './text.js';

export class Examples {
    constructor(model, select_num=2) {
        this.examples = [];
        this.model = model;
        this.select_num = select_num;
        this.embeddings = {};
    }

    // Extracts command tokens (e.g. "!craftRecipe") from a turn's content so the
    // command intent is part of the retrieval key. Assistant turns carry the
    // strongest signal about which command is relevant, so they must not be dropped.
    extractCommands(content) {
        const matches = content.match(/!\w+/g);
        return matches ? matches.join(' ') : '';
    }

    turnsToText(turns) {
        let messages = '';
        for (let turn of turns) {
            if (turn.role === 'assistant') {
                // Include the command intent from the bot's own prior turns.
                const cmds = this.extractCommands(turn.content);
                if (cmds)
                    messages += cmds + '\n';
                continue;
            }
            messages += turn.content.substring(turn.content.indexOf(':')+1).trim() + '\n';
        }
        return messages.trim();
    }

    async load(examples) {
        this.examples = examples;
        if (!this.model) return; // Early return if no embedding model
        
        if (this.select_num === 0)
            return;

        try {
            const turn_texts = examples.map(example => this.turnsToText(example));
            if (typeof this.model.embedMany === 'function') {
                const embeddings = await this.model.embedMany(turn_texts);
                turn_texts.forEach((turn_text, index) => {
                    this.embeddings[turn_text] = embeddings[index];
                });
            }
            else {
                const embeddingPromises = turn_texts.map(turn_text => {
                    return this.model.embed(turn_text)
                        .then(embedding => {
                            this.embeddings[turn_text] = embedding;
                        });
                });
                await Promise.all(embeddingPromises);
            }
        } catch (err) {
            console.warn('Error with embedding model, using word-overlap instead.');
            this.model = null;
        }
    }

    async getRelevant(turns) {
        if (this.select_num === 0)
            return [];

        let turn_text = this.turnsToText(turns);
        if (this.model !== null) {
            let embedding = await this.model.embed(turn_text);
            this.examples.sort((a, b) => 
                cosineSimilarity(embedding, this.embeddings[this.turnsToText(b)]) -
                cosineSimilarity(embedding, this.embeddings[this.turnsToText(a)])
            );
        }
        else {
            if (!this._warned_word_overlap) {
                console.warn('Examples: using weak word-overlap fallback for retrieval (no embedding model available).');
                this._warned_word_overlap = true;
            }
            this.examples.sort((a, b) => 
                wordOverlapScore(turn_text, this.turnsToText(b)) -
                wordOverlapScore(turn_text, this.turnsToText(a))
            );
        }
        let selected = this.examples.slice(0, this.select_num);
        return JSON.parse(JSON.stringify(selected)); // deep copy
    }

    async createExampleMessage(turns) {
        let selected_examples = await this.getRelevant(turns);

        console.log('selected examples:');
        for (let example of selected_examples) {
            console.log('Example:', example[0].content)
        }

        let msg = 'Examples of how to respond:\n';
        for (let i=0; i<selected_examples.length; i++) {
            let example = selected_examples[i];
            msg += `Example ${i+1}:\n${stringifyTurns(example)}\n\n`;
        }
        return msg;
    }
}