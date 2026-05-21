import {deserializeList, serializeList} from "../utils.js";
import {Item} from "./Item.js";
import {HasStats} from "./HasStats.js";

export class NPC extends HasStats {

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
        Slots: ${this.items.length}/${this.itemMaxCapacity}${this.slotWarning()}
        Items:
        ${this.outputItems()}`
    }

    slotWarning() {
        if (this.isAboveCapacity())
            return " (WARNING: Item slots are full!)"
        return "";
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

    fromJson(json) {
        super.fromJson(json);
        this.name = json.name;
        this.itemMaxCapacity = json.itemMaxCapacity;
        this.status = JSON.parse(json.status);
        this.items = deserializeList(json.items, () => new Item());
    }

    toJson() {
        return {
            ...super.toJson(),
            name: this.name,
            status: JSON.stringify(this.status),
            itemMaxCapacity: this.itemMaxCapacity,
            items: serializeList(this.items),
        }
    }

    isAboveCapacity() {
        let slots = 0;
        for (let item of this.items) {
            slots += item.slotCost;
        }

        return false;
    }
}
