import {HasId} from "./HasId.js";

export class HasStats extends HasId {

    constructor() {
        super();
        this.hp = 0;
        this.str = 0;
        this.dex = 0;
        this.wil = 0;
    }

    outputStats() {
        return `HP: ${this.hp} | STR: ${this.str} | DEX: ${this.dex} | WIL: ${this.wil}`;
    }

    fromJson(json) {
        super.fromJson(json);
        this.hp = json.hp;
        this.str = json.str;
        this.dex = json.dex;
        this.wil = json.wil;
    }

    toJson() {
        return {
            ...super.toJson(),
            hp: this.hp,
            str: this.str,
            dex: this.dex,
            wil: this.wil,
        };
    }

}
