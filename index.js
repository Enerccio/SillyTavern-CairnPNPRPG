import {EXTENSION_NAME, EXTENSION_PATH, MODULE_NAME, VERSION} from './conf.js';

// eslint-disable-next-line no-undef
const $ = jQuery;
const context = SillyTavern.getContext();

class Item {

    constructor() {
        this.name = "";
        this.slotCost = 1;
        this.armorBonus = "N/A";
        this.damageDice = "N/A";
        this.fictionalBenefit = "";
        this.internalNote = "";
    }

    toText() {
        return `${this.name} + (${this.slotText()})`;
    }

    toTextFull() {
        return `${this.name}
        Slot Cost: ${this.slotCost}
        Armor Bonus: ${this.armorBonus}
        Damage Dice: ${this.damageDice}
        Fictional Benefit: ${this.fictionalBenefit}
        Internal Note: ${this.internalNote}
        `;
    }

    slotText() {
        if (this.slotCost === 1) {
            return "1 Slot";
        }
        return `${this.slotCost} Slots`;
    }

}

class HasStats {

    constructor() {
        this.hp = 0;
        this.maxhp = 0;
        this.str = 0;
        this.dex = 0;
        this.wil = 0;
    }

    outputStats() {
        return `HP: ${this.hp}/${this.maxhp} | STR: ${this.str} | DEX: ${this.dex} | WIL: ${this.wil}`;
    }

}

class NPC extends HasStats {

    constructor() {
        super();
        this.name = "";
        this.status = [];
        this.items = [];
        this.itemMaxCapacity = 10;
    }

    outputNPC() {
        return `${this.name}
        ${this.outputStats()}
        Status: ${this.outputStatus()}
        Items:
        Slots: ${this.items.length}/${this.itemMaxCapacity}
        ${this.outputItems()}
        `
    }

    outputStatus() {
        let s = "";
        for (let status of this.status) {
            if (s)
                s += "," + status;
            else
                s = status;
        }
        return s;
    }

    outputItems() {
        let s = "";
        for (let i=0; i<this.items.length; i++) {
            const item = `${i}. ${this.items[i].toText()}`;
            if (s)
                s += "\n" + item;
            else
                s = item;
        }
        return s;
    }

}

class RpgTurnState {

    constructor() {
        this.mode = "";
        this.internalModelData = "";
        this.location = "";
        this.locations = "";
        this.definedItems = [];
    }

    toPrompt() {
        return `
        [Game State]
        [Mode]
        ${this.mode}

        [Internal state]
        ${this.internalModelData}

        [Player character]
        ${this.playerCharacter()}

        [Current Location]
        ${this.location}

        [Previous Locations visited]
        ${this.locations}

        [Present NPCS/Enemies]
        ${this.npcs()}

        [Global Item Registry]
        ${this.items()}
        `
    }

    playerCharacter() {
        return `
        `;
    }

    npcs() {
        return `
        `;
    }

    items() {
        let s = "";
        for (let i=0; i<this.definedItems.length; i++) {
            const item = `${i}. ${this.definedItems[i].toTextFull()}`;
            if (s)
                s += "\n" + item;
            else
                s = item;
        }
        return s;
    }

}
