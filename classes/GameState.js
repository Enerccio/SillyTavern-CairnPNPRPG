import {Player} from "./Player.js";
import {Location} from "./Location.js";
import {parseMixedContent} from "../utils.js";
import {INTERNAL_STATE} from "/scripts/extensions/third-party/SillyTavern-CairnPNPRPG/constants.js";

export class GameState {

    constructor() {
        this.id = 0;
        this.location = null;
        this.internalState = "";
        this.player = null;
    }

    init() {
        this.id = 0;
        this.location = new Location();
        this.location.name = "Damp Cellar";
        this.player = new Player();
        this.player.randomize();
    }

    updateFromMessage(message) {
        // Parse UPDATE_STATE
        const parsed = parseMixedContent(message);
        if (parsed.tags) {
            parsed.tags.forEach(tag => {
                if (tag.tag === INTERNAL_STATE) {
                    this.internalState = tag.content;
                }
            })
        }
    }

    fromJson(json) {
        this.id = json.id;
        this.location = new Location();
        this.location.fromJson(json.location);
        this.internalState = json.internalState;
        if (json.player) {
            this.player = new Player();
            this.player.fromJson(json.player);
        }
    }

    toJson() {
        return {
            id: this.id,
            location: this.location.toJson(),
            internalState: this.internalState,
            player: this.player?.toJson()
        };
    }

    toPrompt() {
        return `[GAME STATE ${this.id}]

        [Player]
        ${this.player?.outputNPC()}

        [Current Location]
        ${this.location.toText()}

        [Internal State]
        ${this.internalState}
        `;
    }

}
