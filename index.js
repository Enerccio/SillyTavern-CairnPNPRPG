import {EXTENSION_NAME, EXTENSION_PATH, MODULE_NAME, VERSION} from './conf.js';
import {event_types, eventSource, extension_prompt_roles, saveChat} from "/script.js";
import {
    deserializeList,
    getData,
    log, rollDice,
    serializeList,
    setData
} from "./utils.js";
import {TABLES, WARDEN_PROMPT} from "./definitions.js";
import {GameState} from "./classes/GameState.js";
import {DICE_ROLL_FUNCTION} from "./constants.js";

// eslint-disable-next-line no-undef
const $ = jQuery;
const context = SillyTavern.getContext();
const RPG_KEY = `${MODULE_NAME}_rpg`;
const DEVEL = true;

class RPG {

    constructor() {
        this.state = null;
        this.intermediary = null;
        this.swipeIx = 0;
        this.swipes = [];
        this._messageId = null; // not persisted
    }

    fromJson(json) {
        if (json?.state) {
            this.state = new GameState();
            this.state.fromJson(json.state);
        }
        if (json?.intermediary) {
            this.intermediary = new GameState();
            this.intermediary.fromJson(json.intermediary);
        }
        this.swipeIx = json?.swipeIx;
        this.swipes = deserializeList(json.swipes, () => new GameState())
    }

    toJson() {
        return {
            "state": this.state?.toJson(),
            "intermediary": this.intermediary?.toJson(),
            "swipeIx": this.swipeIx,
            "swipes": serializeList(this.swipes)
        };
    }

}

async function findTopState(startAt = undefined) {
    if (context.chat.length === 0)
        return null;

    if (startAt < 0)
        return null;

    if (startAt === undefined || startAt >= context.chat.length)
        startAt = context.chat.length - 1;

    for (let i=startAt; i>=0; i--) {
        const message = context.chat[i];
        const rpg = getData(message, RPG_KEY);
        if (rpg) {
            const rpgInstance = new RPG();
            rpgInstance.fromJson(rpg);
            rpgInstance._messageId = i;
            return rpgInstance;
        }
    }

    // no rpg found
    const rpg = new RPG();
    rpg.state = new GameState();
    await rpg.state.init();

    const m = context.chat[context.chat.length - 1];
    setData(m, RPG_KEY, rpg.toJson());
    rpg._messageId = context.chat.length - 1;
    return rpg;
}

async function insertRpgData() {
    const prompt = WARDEN_PROMPT;

    const rpg = await findTopState();
    if (!rpg)
        return;

    return prompt + "\n" + rpg.state.toPrompt();
}

async function processPrompt(data) {
    if (isRpgEnabled()) {
        const content = await insertRpgData();
        if (content) {
            const rpgGame = {
                role: "system",
                content: content
            };
            // Insert before the last message
            data.chat.splice(data.chat.length - 1, 0, rpgGame);
        }
    }
}

function rpgEnable() {
    context.setExtensionPrompt(`${MODULE_NAME}_tables`, TABLES, 0, 9999, false, extension_prompt_roles.SYSTEM);

    context.registerFunctionTool({
        name: `${DICE_ROLL_FUNCTION}`,
        stealth: !DEVEL,
        displayName: 'Request Dice Rolls',
        description: 'Call this BEFORE writing your narration to execute all dice rolls needed for the entire turn.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {
                notation: {
                    type: 'string',
                    description: 'Dice to roll in die notation (e.g., "1d20+10")',
                }
            },
            required: ['notation']
        },
        action: async (argumentsObj) => {
            const notation = argumentsObj.notation;
            try {
                const rollResult = rollDice(notation);
                return JSON.stringify({
                    status: "SUCCESS",
                    roll_results: rollResult
                });
            } catch (error) {
                log(error.message);
                return JSON.stringify({
                    status: "ERROR",
                    error: error.message
                });
            }
        }
    });
}

function rpgDisable() {
    // noinspection JSCheckFunctionSignatures
    context.setExtensionPrompt(`${MODULE_NAME}_tables`, "");
    // noinspection JSCheckFunctionSignatures
    context.setExtensionPrompt(`${MODULE_NAME}_gameplay`, "");

    context.macros.registry.unregisterMacro(`${MODULE_NAME}_game`);
    context.unregisterFunctionTool(DICE_ROLL_FUNCTION);
}

function rpgEnableDisable() {
    if (isRpgEnabled())
        rpgEnable();
    else
        rpgDisable();
}

function isRpgEnabled() {
    for (const tag of context.tags) {
        if (tag?.name === "Cairn") {
            return true;
        }
    }
    return false;
}


$(async function () {
    let update_events = [event_types.CHAT_CHANGED, event_types.CHAT_LOADED]
    for (let event of update_events) {
        context.eventSource.on(event, rpgEnableDisable);
    }
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (data) => {
        await processPrompt(data);
    });

    for (let event of [event_types.CHARACTER_MESSAGE_RENDERED]) {
        eventSource.on(event, async (message, wasSwipe) => {
            if (!isRpgEnabled())
                return;
            const m = context.chat[message];
            const rpg = await findTopState(message - 1);

            if (rpg && wasSwipe === "normal") {
                rpg.swipeIx = 0;
                rpg.swipes[0] = new GameState();
                const stateSource = rpg.intermediary ? rpg.intermediary : rpg.state;
                rpg.swipes[0].fromJson(stateSource.toJson());
                rpg.swipes[0].id = stateSource.id + 1;
                rpg.swipes[0].updateFromMessage(m.mes);
                setData(context.chat[rpg._messageId], RPG_KEY, rpg.toJson());
            } else if (rpg && wasSwipe === "swipe") {
                const swipeId = m.swipe_id;
                rpg.swipes[swipeId] = new GameState();
                const stateSource = rpg.intermediary ? rpg.intermediary : rpg.state;
                rpg.swipes[swipeId].fromJson(stateSource.toJson());
                rpg.swipes[swipeId].id = stateSource.id + 1;
                rpg.swipes[swipeId].updateFromMessage(m.mes);
                rpg.swipeIx = swipeId;
                setData(context.chat[rpg._messageId], RPG_KEY, rpg.toJson());
            }

        });
    }

    eventSource.on(event_types.MESSAGE_SENT, async (messageId) => {
        if (!isRpgEnabled())
            return;

        const m = context.chat[messageId];
        const rpg = await findTopState(messageId - 1);
        if (rpg) {
            // we persist last swipe into new rpg
            const newRpgState = new RPG();
            newRpgState.state = new GameState();
            newRpgState.state.fromJson(rpg.swipes[rpg.swipeIx].toJson());
            setData(m, RPG_KEY, newRpgState.toJson());
        }
    });
});
