
export class Item {

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

    toJson() {
        return {
            name: this.name,
            slotCost: this.slotCost,
            armorBonus: this.armorBonus,
            damageDice: this.damageDice,
            fictionalBenefit: this.fictionalBenefit,
            internalNote: this.internalNote,
        };
    }

    fromJson(json) {
        this.name = json.name;
        this.slotCost = json.slotCost;
        this.armorBonus = json.armorBonus;
        this.damageDice = json.damageDice;
        this.fictionalBenefit = json.fictionalBenefit;
        this.internalNote = json.internalNote;
    }

}
