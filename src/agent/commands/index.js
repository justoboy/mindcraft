import { getBlockId, getItemId } from "../../utils/mcdata.js";
import { actionsList } from './actions.js';
import { queryList } from './queries.js';

let suppressNoDomainWarning = true;

const commandList = queryList.concat(actionsList);
const commandMap = {};
for (let command of commandList) {
    commandMap[command.name] = command;
}

export function getCommand(name) {
    return commandMap[name];
}

export function blacklistCommands(commands) {
    const unblockable = ['!stop', '!stats', '!inventory', '!goal'];
    for (let command_name of commands) {
        if (unblockable.includes(command_name)){
            console.warn(`Command ${command_name} is unblockable`);
            continue;
        }
        delete commandMap[command_name];
        delete commandList.find(command => command.name === command_name);
    }
}

const commandRegex = /!(\w+)(?:\(((?:-?\d+(?:\.\d+)?|true|false|"[^"]*")(?:\s*,\s*(?:-?\d+(?:\.\d+)?|true|false|"[^"]*"))*)\))?/
const argRegex = /-?\d+(?:\.\d+)?|true|false|"[^"]*"/g;

export function containsCommand(message) {
    const commandMatch = message.match(commandRegex);
    if (commandMatch)
        return "!" + commandMatch[1];
    return null;
}

export function commandExists(commandName) {
    if (!commandName.startsWith("!"))
        commandName = "!" + commandName;
    return commandMap[commandName] !== undefined;
}

/**
 * Levenshtein edit distance between two strings (case-insensitive comparison).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function editDistance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const curr = [i];
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = curr;
    }
    return prev[n];
}

/**
 * Suggests the closest existing command to a (likely hallucinated) command name,
 * using edit distance. Returns null if nothing is close enough to be useful.
 * @param {string} commandName - the unknown command, with or without leading "!"
 * @returns {string|null} the suggested command name (with "!") or null
 */
export function suggestCommand(commandName) {
    const raw = commandName.startsWith("!") ? commandName.slice(1) : commandName;
    let best = null;
    let bestDist = Infinity;
    for (let name of Object.keys(commandMap)) {
        const dist = editDistance(raw, name.slice(1));
        if (dist < bestDist) {
            bestDist = dist;
            best = name;
        }
    }
    // Only suggest if reasonably close to the intended command.
    const threshold = Math.max(2, Math.floor(raw.length / 2));
    if (best && bestDist <= threshold)
        return best;
    return null;
}

/**
 * Converts a string into a boolean.
 * @param {string} input
 * @returns {boolean | null} the boolean or `null` if it could not be parsed.
 * */
function parseBoolean(input) {
    switch(input.toLowerCase()) {
        case 'false': //These are interpreted as flase;
        case 'f':
        case '0':
        case 'off':
            return false;
        case 'true': //These are interpreted as true;
        case 't':
        case '1':
        case 'on':
            return true;
        default:
            return null;
    }
}

/**
 * @param {number} value - the value to check
 * @param {number} lowerBound
 * @param {number} upperBound
 * @param {string} endpointType - The type of the endpoints represented as a two character string. `'[)'` `'()'` 
 */
function checkInInterval(number, lowerBound, upperBound, endpointType) {
    switch (endpointType) {
        case '[)':
            return lowerBound <= number && number < upperBound;
        case '()':
            return lowerBound < number && number < upperBound;
        case '(]':
            return lowerBound < number && number <= upperBound;
        case '[]':
            return lowerBound <= number && number <= upperBound;
        default:
            throw new Error('Unknown endpoint type:', endpointType)
    }
}



// todo: handle arrays?
/**
 * Returns an object containing the command, the command name, and the comand parameters.
 * If parsing unsuccessful, returns an error message as a string.
 * @param {string} message - A message from a player or language model containing a command.
 * @returns {string | Object}
 */
export function parseCommandMessage(message) {
    const commandMatch = message.match(commandRegex);
    if (!commandMatch) return `Command is incorrectly formatted`;

    const commandName = "!"+commandMatch[1];

    let args;
    if (commandMatch[2]) args = commandMatch[2].match(argRegex);
    else args = [];

    const command = getCommand(commandName);
    if(!command) {
        const suggestion = suggestCommand(commandName);
        return suggestion
            ? `${commandName} is not a command. Did you mean ${suggestion}?`
            : `${commandName} is not a command.`;
    }

    const params = commandParams(command);
    const paramNames = commandParamNames(command);

    if (args.length !== params.length)
        return `Command ${command.name} was given ${args.length} args, but requires ${params.length} args. Correct usage: ${commandSignature(command)}.`;

    
    for (let i = 0; i < args.length; i++) {
        const param = params[i];
        //Remove any extra characters
        let arg = args[i].trim();
        if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
            arg = arg.substring(1, arg.length-1);
        }
        
        //Convert to the correct type
        switch(param.type) {
            case 'int':
                arg = Number.parseInt(arg); break;
            case 'float':
                arg = Number.parseFloat(arg); break;
            case 'boolean':
                arg = parseBoolean(arg); break;
            case 'BlockName':
            case 'BlockOrItemName':
            case 'ItemName':
                if (arg.endsWith('plank') || arg.endsWith('seed'))
                    arg += 's'; // add 's' to for common mistakes like "oak_plank" or "wheat_seed"
            case 'string':
                break;
            default:
                throw new Error(`Command '${commandName}' parameter '${paramNames[i]}' has an unknown type: ${param.type}`);
        }
        if(arg === null || Number.isNaN(arg))
            return `Error: Param '${paramNames[i]}' must be of type ${param.type}.`

        if(typeof arg === 'number') { //Check the domain of numbers
            const domain = param.domain;
            if(domain) {
                /**
                 * Javascript has a built in object for sets but not intervals.
                 * Currently the interval (lowerbound,upperbound] is represented as an Array: `[lowerbound, upperbound, '(]']`
                 */
                if (!domain[2]) domain[2] = '[)'; //By default, lower bound is included. Upper is not.

                if(!checkInInterval(arg, ...domain)) {
                    return `Error: Param '${paramNames[i]}' must be an element of ${domain[2][0]}${domain[0]}, ${domain[1]}${domain[2][1]}.`;
                    //Alternatively arg could be set to the nearest value in the domain.
                }
            } else if (!suppressNoDomainWarning) {
                console.warn(`Command '${commandName}' parameter '${paramNames[i]}' has no domain set. Expect any value [-Infinity, Infinity].`)
                suppressNoDomainWarning = true; //Don't spam console. Only give the warning once.
            }
        } else if(param.type === 'BlockName') { //Check that there is a block with this name
            if(getBlockId(arg) == null) return  `Invalid block type: ${arg}.`
        } else if(param.type === 'ItemName') { //Check that there is an item with this name
            if(getItemId(arg) == null) return `Invalid item type: ${arg}.`
        } else if(param.type === 'BlockOrItemName') {
            if(getBlockId(arg) == null && getItemId(arg) == null) return  `Invalid block or item type: ${arg}.`
        }
        args[i] = arg;
    }
    
    return { commandName, args };
}

export function truncCommandMessage(message) {
    const commandMatch = message.match(commandRegex);
    if (commandMatch) {
        return message.substring(0, commandMatch.index + commandMatch[0].length);
    }
    return message;
}

export function isAction(name) {
    return actionsList.find(action => action.name === name) !== undefined;
}

/**
 * @param {Object} command
 * @returns {Object[]} The command's parameters.
 */
function commandParams(command) {
    if (!command.params)
        return [];
    return Object.values(command.params);
}

/**
 * @param {Object} command
 * @returns {string[]} The names of the command's parameters.
 */
function commandParamNames(command) {
    if (!command.params)
        return [];
    return Object.keys(command.params);
}

/**
 * Builds a correct-usage example string for a command, e.g.
 * `!collectBlocks("BlockOrItemName", number)`. Used to give the model a concrete
 * signature in error feedback so it can self-correct.
 * @param {Object} command
 * @returns {string}
 */
function commandSignature(command) {
    const paramNames = commandParamNames(command);
    if (paramNames.length === 0)
        return command.name;
    const placeholders = paramNames.map((name) => {
        const type = command.params[name].type;
        if (type === 'int' || type === 'float')
            return 'number';
        if (type === 'boolean')
            return 'true|false';
        return `"${name}"`;
    });
    return `${command.name}(${placeholders.join(', ')})`;
}

function numParams(command) {
    return commandParams(command).length;
}

export async function executeCommand(agent, message) {
    let parsed = parseCommandMessage(message);
    if (typeof parsed === 'string')
        return parsed; //The command was incorrectly formatted or an invalid input was given.
    else {
        console.log('parsed command:', parsed);
        const command = getCommand(parsed.commandName);
        let numArgs = 0;
        if (parsed.args) {
            numArgs = parsed.args.length;
        }
        if (numArgs !== numParams(command))
            return `Command ${command.name} was given ${numArgs} args, but requires ${numParams(command)} args.`;
        else {
            const result = await command.perform(agent, ...parsed.args);
            return result;
        }
    }
}

export function getCommandDocs(agent) {
    const typeTranslations = {
        //This was added to keep the prompt the same as before type checks were implemented.
        //If the language model is giving invalid inputs changing this might help.
        'float':             'number',
        'int':               'number',
        'BlockName':         'string',
        'ItemName':          'string',
        'BlockOrItemName':   'string',
        'boolean':           'bool'
    }
    let docs = `\n*COMMAND DOCS\n You can use the following commands to perform actions and get information about the world. 
    Use the commands with the syntax: !commandName or !commandName("arg1", 1.2, ...) if the command takes arguments.\n
    Do not use codeblocks. Use double quotes for strings. Only use one command in each response, trailing commands and comments will be ignored.\n`;
    for (let command of commandList) {
        if (agent.blocked_actions.includes(command.name)) {
            continue;
        }
        docs += command.name + ': ' + command.description + '\n';
        if (command.params) {
            docs += 'Params:\n';
            for (let param in command.params) {
                docs += `${param}: (${typeTranslations[command.params[param].type]??command.params[param].type}) ${command.params[param].description}\n`;
            }
        }
    }
    return docs + '*\n';
}
