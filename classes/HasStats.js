
export class HasStats {

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

    fromJson(json) {
        this.hp = json.hp;
        this.maxhp = json.maxhp;
        this.str = json.str;
        this.dex = json.dex;
        this.wil = json.wil;
    }

    toJson() {
        return {
            hp: this.hp,
            maxhp: this.maxhp,
            str: this.str,
            dex: this.dex,
            wil: this.wil,
        };
    }

}
