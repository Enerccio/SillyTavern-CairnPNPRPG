import {NPC} from "./NPC.js";
import {rollDice} from "../utils.js";
import {user_avatar} from "/scripts/personas.js";
import {power_user} from "/scripts/power-user.js";

export class Player extends NPC {

    constructor() {
        super();

        this.age = null;
    }

    randomize() {
        const personas = Object.entries(power_user.personas).map(([avatar, name]) => ({ avatar, name }));
        this.name = personas.find(a => a.avatar === user_avatar).name;
        this.age = rollDice("2d20+10");
        this.hp = rollDice("1d6");
        this.maxhp = this.hp;
        this.str = rollDice("3d6");
        this.dex = rollDice("3d6");
        this.wil = rollDice("3d6");
    }

    fromJson(json) {
        super.fromJson(json);

        this.age = json.age;
    }

    toJson(json) {
        return {
            ...super.toJson(json),
            age: this.age,
        };
    }


}
