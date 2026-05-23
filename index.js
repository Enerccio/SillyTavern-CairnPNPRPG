import {MODULE_NAME} from './conf.js';
import {event_types, eventSource, extension_prompt_roles, redisplayChat} from "/script.js";
import {
    deserializeList,
    getData,
    getMessageDiv,
    log,
    manualEdit,
    processInputStream,
    rollDice,
    serializeList,
    setData
} from "./utils.js";
import {FIRST_PROMPT_RULES, TABLES, WARDEN_PROMPT} from "./definitions.js";
import {GameState} from "./classes/GameState.js";
import {cairnDebugButton, DICE_ROLL_FUNCTION} from "./constants.js";
import {formatting_stage, hook_order, MessageFormatter} from "/scripts/message-formatter.js";
import {t} from "/scripts/i18n.js";
import { tag_map } from "/scripts/tags.js";

// eslint-disable-next-line no-undef
const $ = jQuery;
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
    if (SillyTavern.getContext().chat.length === 0)
        return null;

    if (startAt < 0)
        return null;

    if (startAt === undefined || startAt >= SillyTavern.getContext().chat.length)
        startAt = SillyTavern.getContext().chat.length - 1;

    for (let i=startAt; i>=0; i--) {
        const message = SillyTavern.getContext().chat[i];
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

    const m = SillyTavern.getContext().chat[SillyTavern.getContext().chat.length - 1];
    setData(m, RPG_KEY, rpg.toJson());
    rpg._messageId = SillyTavern.getContext().chat.length - 1;
    return rpg;
}

async function insertRpgData() {
    let prompt = WARDEN_PROMPT;

    const rpg = await findTopState();
    if (!rpg)
        return;

    if (rpg.state.id === 0) {
        prompt += FIRST_PROMPT_RULES;
    }

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
    SillyTavern.getContext().setExtensionPrompt(`${MODULE_NAME}_tables`, TABLES, 0, 9999, false, extension_prompt_roles.SYSTEM);

    SillyTavern.getContext().registerFunctionTool({
        name: `${DICE_ROLL_FUNCTION}`,
        stealth: !DEVEL,
        displayName: 'Request Dice Roll',
        description: 'Call this BEFORE needing a roll value.',
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
    SillyTavern.getContext().setExtensionPrompt(`${MODULE_NAME}_tables`, "");
    // noinspection JSCheckFunctionSignatures
    SillyTavern.getContext().setExtensionPrompt(`${MODULE_NAME}_gameplay`, "");

    SillyTavern.getContext().macros.registry.unregisterMacro(`${MODULE_NAME}_game`);
    SillyTavern.getContext().unregisterFunctionTool(DICE_ROLL_FUNCTION);
}

async function rpgEnableDisable() {
    await updateAllMessageVisuals();
    if (isRpgEnabled())
        rpgEnable();
    else
        rpgDisable();
}

function isRpgEnabled() {
    const ctx = SillyTavern.getContext();
    const activeCharacters = [];

    if (ctx.groupId !== null && ctx.groupId !== undefined) {
        const currentGroup = ctx.groups.find(g => g.id === ctx.groupId);
        if (currentGroup && Array.isArray(currentGroup.members)) {
            currentGroup.members.forEach(memberId => {
                const char = ctx.characters.find(c => c.avatar === memberId || c.id === memberId);
                if (char) activeCharacters.push(char);
            });
        }
    } else if (ctx.characterId !== null && ctx.characterId !== undefined && ctx.characterId >= 0) {
        const char = ctx.characters[ctx.characterId];
        if (char) activeCharacters.push(char);
    }

    return activeCharacters.some(char => {
        const characterTagIds = tag_map[char.avatar] || [];

        return characterTagIds.some(tagId => {
            const globalTag = ctx.tags.find(t => t.id === tagId);
            return globalTag && globalTag.name === "Cairn";
        });
    });
}

async function updateMessageVisuals(i) {
    let divElement = getMessageDiv(i);
    if (!divElement) {
        return;
    }
    if (!DEVEL)
        return;

    const oldDiv = divElement.find(`div.${cairnDebugButton}`);
    oldDiv.remove();

    if (!isRpgEnabled())
        return;

    let message = SillyTavern.getContext().chat[i];
    let rpgState = getData(message, RPG_KEY);
    if (!rpgState || !rpgState.state)
        return;

    let mesAvatarWrapper = divElement.find('.mesAvatarWrapper');
    let $icon = $(`<div title="${t`Edit Internal State`}" class="mes_button ${cairnDebugButton} fa-solid fa-brain" tabindex="0"></div>`);
    $icon.on('click', async () => {
        rpgState = getData(message, RPG_KEY);
        const newData = await manualEdit(rpgState);
        if (newData) {
            rpgState.state = newData;
            setData(message, rpgState, RPG_KEY);
        }
    });
    mesAvatarWrapper.append($icon);
}

async function updateAllMessageVisuals() {
    // update the message visuals of each visible message, styled according to the inclusion criteria
    let chat = SillyTavern.getContext().chat;
    // noinspection JSUnresolvedReference
    let firstDisplayedId = Number($('#chat').children('.mes').first().attr('mesid'))
    for (let i=chat.length-1; i >= firstDisplayedId; i--) {
        await updateMessageVisuals(i);
    }
}

$(async function () {
    let update_events = [event_types.CHAT_CHANGED, event_types.CHAT_LOADED]
    for (let event of update_events) {
        SillyTavern.getContext().eventSource.on(event, rpgEnableDisable);
    }
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (data) => {
        await processPrompt(data);
    });

    for (let event of [event_types.CHARACTER_MESSAGE_RENDERED]) {
        eventSource.on(event, async (message, wasSwipe) => {
            if (!isRpgEnabled())
                return;
            const m = SillyTavern.getContext().chat[message];
            const rpg = await findTopState(message - 1);

            if (!rpg) return;

            const stateSource = rpg.intermediary ? rpg.intermediary : rpg.state;
            const sourceJsonString = JSON.stringify(stateSource.toJson());

            if (wasSwipe === "normal") {
                rpg.swipeIx = 0;

                const newSwipeState = new GameState();
                newSwipeState.fromJson(JSON.parse(sourceJsonString));
                newSwipeState.id = stateSource.id + 1;

                const result = newSwipeState.updateFromMessage(m.mes);
                m.mes = result.message;

                rpg.swipes[0] = newSwipeState;
                setData(SillyTavern.getContext().chat[rpg._messageId], RPG_KEY, rpg.toJson());

            } else if (wasSwipe === "swipe") {
                const swipeId = m.swipe_id;

                const newSwipeState = new GameState();
                newSwipeState.fromJson(JSON.parse(sourceJsonString));
                newSwipeState.id = stateSource.id + 1;

                const result = newSwipeState.updateFromMessage(m.mes);
                m.swipes[swipeId] = result.message;
                m.mes = result.message;

                rpg.swipeIx = swipeId;
                rpg.swipes[swipeId] = newSwipeState;
                setData(SillyTavern.getContext().chat[rpg._messageId], RPG_KEY, rpg.toJson());
            }

            await redisplayChat({ targetChat: SillyTavern.getContext().chat, startIndex: message, fade: false});
            setTimeout(() => updateAllMessageVisuals(), 250);
        });
    }

    eventSource.on(event_types.MESSAGE_SENT, async (messageId) => {
        if (!isRpgEnabled())
            return;

        const m = SillyTavern.getContext().chat[messageId];
        const rpg = await findTopState(messageId - 1);
        if (rpg) {
            // we persist last swipe into new rpg
            const newRpgState = new RPG();
            newRpgState.state = new GameState();
            newRpgState.state.fromJson(rpg.swipes[rpg.swipeIx].toJson());
            newRpgState.state.clearCaches();
            setData(m, RPG_KEY, newRpgState.toJson());
        }
        setTimeout(() => updateAllMessageVisuals(), 250);
    });

    MessageFormatter.addHook(processInputStream, {
        stage: formatting_stage.BEFORE_REGEX,
        order: hook_order.EARLIEST
    });
});
