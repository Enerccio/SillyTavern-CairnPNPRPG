import {EXTENSION_NAME, EXTENSION_PATH, MODULE_NAME, VERSION} from './conf.js';
import {debounce} from "/scripts/utils.js";
import {extension_settings, renderExtensionTemplateAsync} from "/scripts/extensions.js";
import {saveChatDebounced, saveSettingsDebounced} from "/script.js";
import {Popup, POPUP_TYPE} from "/scripts/popup.js";

export function log() {
    console.log(`[${EXTENSION_NAME}]`, ...arguments);
}

export function error() {
    console.error(`[${EXTENSION_NAME}]`, ...arguments);
    // noinspection JSUnresolvedReference
    toastr.error(Array.from(arguments).join(' '), EXTENSION_NAME);
}

export function toast(message, type="info") {
    // debounce the toast messages
    // noinspection JSUnresolvedReference
    toastr[type](message, EXTENSION_NAME);
}


export function escapeString(text) {
    // escape control characters in the text
    if (!text) return text
    return text.replace(/[\x00-\x1F\x7F]/g, function(match) {
        // Escape control characters
        switch (match) {
            case '\n': return '\\n';
            case '\t': return '\\t';
            case '\r': return '\\r';
            case '\b': return '\\b';
            case '\f': return '\\f';
            default: return '\\x' + match.charCodeAt(0).toString(16).padStart(2, '0');
        }
    });
}

export function unescapeString(text) {
    // given a string with escaped characters, unescape them
    if (!text) return text
    return text.replace(/\\[ntrbf0x][0-9a-f]{2}|\\[ntrbf]/g, function(match) {
        switch (match) {
            case '\\n': return '\n';
            case '\\t': return '\t';
            case '\\r': return '\r';
            case '\\b': return '\b';
            case '\\f': return '\f';
            default: {
                // Handle escaped hexadecimal characters like \\xNN
                const hexMatch = match.match(/\\x([0-9a-f]{2})/i);
                if (hexMatch) {
                    return String.fromCharCode(parseInt(hexMatch[1], 16));
                }
                return match; // Return as is if no match
            }
        }
    });
}

export const toastDebounced = debounce(toast, 500);


export function setSettings(key, value, copy=false) {
    // Set a setting for the extension and save it
    if (copy) {
        value = structuredClone(value)
    }
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
    extension_settings[MODULE_NAME][key] = value;
    saveSettingsDebounced();
}

export function getSettings(key, copy=false, defval = "") {
    // Get a setting for the extension, or the default value if not set
    let value = extension_settings[MODULE_NAME]?.[key] ?? defval;
    if (copy) {  // needed when retrieving objects
        return structuredClone(value)
    } else {
        return value
    }
}

export function setData(message, key, value) {
    // store information on the message object
    if (!message.extra) {
        message.extra = {};
    }
    if (!message.extra[MODULE_NAME]) {
        message.extra[MODULE_NAME] = {};
    }

    message.extra[MODULE_NAME][key] = value;

    // Also save on the current swipe info if present
    let swipe_index = message.swipe_id
    if (swipe_index && message.swipe_info?.[swipe_index]) {
        if (!message.swipe_info[swipe_index].extra) {
            message.swipe_info[swipe_index].extra = {};
        }
        message.swipe_info[swipe_index].extra[MODULE_NAME] = structuredClone(message.extra[MODULE_NAME])
    }

    saveChatDebounced();
}

export function getData(message, key) {
    // get information from the message object
    return message?.extra?.[MODULE_NAME]?.[key];
}

export function serializeList(list) {
    if (!list)
        return [];

    const l = [];
    for (let x of list) {
        l.push(x.toJson());
    }
    return l;
}

export function deserializeList(json, provider) {
    if (!json)
        return [];

    const l = [];
    for (let x of json) {
        const object = provider();
        object.fromJson(x);
        l.push(object);
    }
    return l;
}

export function rollDice(notation) {
    // Remove spaces and convert to uppercase for consistency
    const sanitized = notation.replace(/\s+/g, '').toUpperCase();

    // Split by + or - but keep the delimiter to know if we add or subtract
    // This regex splits the string into parts like ["2d6", "+4", "1d10"]
    const parts = sanitized.split(/([+-])/);

    let total = 0;
    let currentOp = '+'; // Default first operation is addition

    for (let part of parts) {
        if (part === '+' || part === '-') {
            currentOp = part;
            continue;
        }

        let value = 0;

        if (part.includes('D')) {
            // Handle dice notation (e.g., "2d6" or "d20")
            const [countStr, sidesStr] = part.split('D');

            // If no count is provided (e.g., "d20"), default to 1
            const count = countStr === '' ? 1 : parseInt(countStr, 10);
            const sides = parseInt(sidesStr, 10);

            if (isNaN(count) || isNaN(sides) || sides <= 0) {
                throw new Error(`Invalid dice notation: ${part}`);
            }

            // Roll the die 'count' times and sum them up
            for (let i = 0; i < count; i++) {
                value += Math.floor(Math.random() * sides) + 1;
            }
        } else {
            // Handle flat modifiers (e.g., "10")
            value = parseInt(part, 10);
            if (isNaN(value)) {
                throw new Error(`Invalid modifier: ${part}`);
            }
        }

        // Apply the result based on the current operator
        if (currentOp === '+') {
            total += value;
        } else if (currentOp === '-') {
            total -= value;
        }
    }

    return total;
}

export function parseMixedContent(inputString) {
    if (typeof inputString !== 'string') return { tags: [], message: '' };

    // UPDATED REGEX: Matches EITHER a self-closing tag OR a standard paired tag block
    const xmlRegex = /<([\w-]+:)?([\w-]+)([^>]*?)(?:\/>|>([\s\S]*?)<\/\1?\2>)/g;

    const tags = [];
    let match;

    while ((match = xmlRegex.exec(inputString)) !== null) {
        // match[4] will contain the inner content if it was a paired tag
        const [fullMatch, prefix, tagName, attrString, content] = match;

        const attributes = {};
        const attrRegex = /([\w-]+)=["']([^"']*)["']/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrString)) !== null) {
            attributes[attrMatch[1]] = attrMatch[2];
        }

        // Push structured tag data to the array
        tags.push({
            tag: tagName,
            prefix: prefix ? prefix.replace(':', '') : null, // Useful to verify "enerccio_cairn"
            content: content ? content.trim() : '',         // Safe fallback for self-closing tags
            attributes: attributes
        });
    }

    // Safely strip the parsed tags out of the message text
    const cleanedMessage = inputString.replace(xmlRegex, '').trim();

    return {
        tags: tags,
        message: cleanedMessage
    };
}

export async function manualEdit(serializedRpg) {
    const template = $(await renderExtensionTemplateAsync(EXTENSION_PATH, 'debug'));
    const prompt = template.find('#debugPrompt');
    prompt.val(JSON.stringify(serializedRpg, null, 2));
    const popup = new Popup(template, POPUP_TYPE.CONFIRM, '', { wide: true, large: true, okButton: 'Save changes', cancelButton: 'Close'});
    const result = await popup.show();

    // If the user cancels, return the original input
    if (!result) {
        return null;
    }

    const output = String(prompt.val());
    return JSON.parse(output);
}

export function getMessageDiv(index) {
    // given a message index, get the div element for that message
    // it will have an attribute "mesid" that is the message index
    // noinspection JSUnresolvedReference
    let div = $(`div[mesid="${index}"]`);
    if (div.length === 0) {
        return null;
    }
    return div;
}

let cairnAnimFrameIndex = 0;
export function processInputStream(data, ctx) {
    if (typeof data !== 'string') return data;

    if (ctx.isReasoning)
        return data;

    // Added a specific middle group for self-closing tags: <enerccio_cairn... />
    const regex = /(?<!`)(?:(<enerccio_cairn[^>]*>[\s\S]*?<\/enerccio_cairn[^>]*>)|(<enerccio_cairn[^>]*\/>)|(<enerccio_cairn[\s\S]*))/gi;
    let removedAggressively = false;

    const result = data.replace(regex, (match, closedGroup, selfClosingGroup, unclosedGroup) => {
        // Only trigger if it falls explicitly into the unclosedGroup (now the 3rd group)
        if (unclosedGroup !== undefined) {
            removedAggressively = true;
        }
        return '';
    });

    if (removedAggressively) {
        const frames = [
            ".", "..", "...",
            "...T", "...Th", "...Thi", "...Thin", "...Think", "...Thinki", "...Thinkin", "...Thinking",
            "...Thinking.", "...Thinking..", "...Thinking..."
        ];

        const currentFrame = frames[cairnAnimFrameIndex % frames.length];
        cairnAnimFrameIndex++;

        return `${result}${currentFrame}`;
    } else {
        cairnAnimFrameIndex = 0;
    }

    return result;
}
