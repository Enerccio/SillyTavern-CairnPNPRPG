import {HasId} from "./HasId.js";

export class Location extends HasId {

    constructor() {
        super();
        this.name = "";
        this.explored = false;
        this.description = "";
        this.internalNote = "";
        this.itemIds = [];
        this.npcIds = [];
        this.exitIds = {};
    }

    fromJson(json) {
        super.fromJson(json);
        this.name = json.name;
        this.explored = json.explored;
        this.description = json.description;
        this.internalNote = json.internalNote;
        this.itemIds = json.itemIds;
        this.npcIds = json.npcIds;
        this.exitIds = json.exitIds;
    }

    toJson() {
        return {
            ...super.toJson(),
            name: this.name,
            explored: this.explored,
            description: this.description,
            internalNote: this.internalNote,
            itemIds: this.itemIds,
            npcIds: this.npcIds,
            exitIds: this.exitIds
        };
    }

    toText(gs) {
        const exitDirections = Object.keys(this.exitIds);

        const exitsText = exitDirections.length === 0
            ? "No available exits defined yet."
            : exitDirections.map(dir => {
                const destinationUuid = this.exitIds[dir];
                const location = gs.getLocation(destinationUuid);
                const aiFriendlyName = gs.localizeKeyForAI(destinationUuid);
                return `   - ${dir.toUpperCase()} leads to: ${aiFriendlyName} - ` + (location.explored ? "[TARGET_LOCATION_STATUS: EXPLORED]" : "[TARGET_LOCATION_STATUS: UNEXPLORED]" );
            }).join('\n');

        return `${this.name}
        [Location Description]
        ${this.description}
        [Internal Note]
        ${this.internalNote}
        [Available Structural Exits]
        ${exitsText}`;
    }

    static TestDungeon() {
        const l = new Location();

        l.name = "Damp Cell";
        l.description = "A dank, musty cell with cobwebs and moldy walls. Strangely, door is ajar.";
        l.internalNote = "No Internal Note assigned yet.";

        return l;
    }

}
