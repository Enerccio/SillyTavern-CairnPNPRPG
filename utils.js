import {EXTENSION_NAME, EXTENSION_PATH, MODULE_NAME, VERSION} from './conf.js';
import {debounce} from "/scripts/utils.js";
import {extension_settings} from "/scripts/extensions.js";
import {saveSettingsDebounced} from "/script.js";

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
