import {Player} from "./Player.js";
import {Location} from "./Location.js";
import {log, parseMixedContent} from "../utils.js";
import {CHANGE_LOCATION, INTERNAL_STATE, UPDATE_LOCATION} from "../constants.js";

export class GameState {

    constructor() {
        this.id = 0;
        this.locationId = "";
        this.internalState = "";
        this.player = null;
        this.npcRegistry = {};
        this.locationRegistry = {};

        this.keyLocalizer = {};
        this.invertedKeyLocalizer = {};
        this.keyLocalizerCache = {};
    }

    init() {
        this.id = 0;
        const startLoc = Location.TestDungeon();
        this.locationRegistry[startLoc.id] = startLoc;
        this.locationId = startLoc.id;
        this.player = new Player();
        this.player.randomize();
    }

    get currentLoc() {
        return this.locationRegistry[this.locationId] || null;
    }

    clearCaches() {
        this.keyLocalizer = {};
        this.invertedKeyLocalizer = {};
        this.keyLocalizerCache = {};
    }

    updateFromMessage(message) {
        // Parse UPDATE_STATE
        const parsed = parseMixedContent(message);
        log("Messages passed from AI: " + JSON.stringify(parsed, null, 2));

        if (parsed.tags) {
            parsed.tags.forEach(tag => {
                if (tag.tag === INTERNAL_STATE) {
                    this.internalState = tag.content;
                    return;
                }

                if (tag.tag === INTERNAL_STATE) {
                    this.internalState = tag.content;
                }

                const attrs = tag.attributes;

                // 2. RUN ARCHITECTURE: CREATE A NEW LOCATION RECORD
                if (tag.tag === "new_location") {
                    const direction = attrs.direction?.trim(); // Can now be "iron gate", "trapdoor", etc.
                    const name = attrs.name;
                    if (!direction || !name) return;

                    // Safety: Check if current room already has an entry on this exact path string
                    if (this.currentLoc.exitIds[direction]) {
                        log(`Exit '${direction}' already occupied in this room. Skipping creation.`);
                        return;
                    }

                    const newLoc = new Location();
                    newLoc.name = name;
                    newLoc.description = attrs.description || "";
                    newLoc.internalNote = attrs.internalNote || "";

                    const targetId = newLoc.id;
                    this.locationRegistry[targetId] = newLoc;

                    // Bi-directional link execution
                    this.currentLoc.exitIds[direction] = targetId;
                    this.currentLoc.explored = true;

                    // SMART REVERSE-LINKING:
                    // If it's a standard cardinal direction, use its math opposite.
                    // If it's custom, create an organic return path descriptor like "passage back to [Old Room Name]"
                    const opposites = { north: "south", south: "north", east: "west", west: "east", up: "down", down: "up" };
                    const returnDir = attrs.returnDirection || opposites[direction.toLowerCase()] || `passage back to ${this.currentLoc.name}`;

                    this.locationRegistry[targetId].exitIds[returnDir] = this.currentLoc.id;

                    log(`[Cairn Engine] Linked graph node: ${this.currentLoc.name} (${direction}) <-> ${name}`);
                    return;
                }

                // 3. RUN MODIFICATION: MODIFY CURRENT ROOM FIELDS
                if (tag.tag === UPDATE_LOCATION) {
                    if (attrs.name) this.currentLoc.name = attrs.name;
                    if (attrs.description) this.currentLoc.description = attrs.description;
                    if (attrs.internalNote) this.currentLoc.internalNote = attrs.internalNote;
                    log(`[Cairn Engine] Updated active location fields.`);
                    return;
                }

                // 4. RUN NAVIGATION: SHIFT ACTIVE LOCATION MARKER
                if (tag.tag === CHANGE_LOCATION) {
                    const aiInputName = attrs.name?.trim(); // e.g., could be "Kitchen" or "Kitchen (A)"
                    if (!aiInputName) return;

                    let targetUuid = this.invertedKeyLocalizer[aiInputName];

                    // FUZZY FALLBACK: If the AI forgot the suffix (e.g. sent "Kitchen" instead of "Kitchen (A)")
                    if (!targetUuid) {
                        const activeRoom = this.currentLoc;
                        if (activeRoom) {
                            // Scan all active exits out of the current room
                            targetUuid = Object.values(activeRoom.exitIds).find(id => {
                                const registeredRoom = this.locationRegistry[id];
                                return registeredRoom && registeredRoom.name.toLowerCase() === aiInputName.toLowerCase();
                            });
                        }
                    }

                    if (targetUuid && this.locationRegistry[targetUuid]) {
                        this.locationId = targetUuid; // Execute the pointer swap
                        log(`[Cairn Engine] Moved player node to: ${this.currentLoc.name} (${targetUuid})`);
                    } else {
                        log(`[Error] Could not resolve location tag name "${aiInputName}" back to any valid UUID.`);
                    }
                    return;
                }
            })
        }

        return parsed;
    }

    fromJson(json) {
        this.id = json.id;
        this.internalState = json.internalState;
        this.keyLocalizer = json.keyLocalizer;
        this.invertedKeyLocalizer = json.invertedKeyLocalizer;
        this.keyLocalizerCache = json.keyLocalizerCache;
        this.locationId = json.locationId;
        if (json.player) {
            this.player = new Player();
            this.player.fromJson(json.player);
        }
        // Inflate the global location dictionary map first
        this.locationRegistry = {};
        if (json.locationRegistry) {
            Object.keys(json.locationRegistry).forEach(id => {
                const loc = new Location();
                loc.fromJson(json.locationRegistry[id]);
                this.locationRegistry[id] = loc;
            });
        }
    }

    toJson() {
        const serializedRegistry = {};
        Object.keys(this.locationRegistry).forEach(id => {
            serializedRegistry[id] = this.locationRegistry[id].toJson();
        });

        return {
            id: this.id,
            locationId: this.locationId,
            locationRegistry: serializedRegistry,
            internalState: this.internalState,
            keyLocalizer: this.keyLocalizer,
            invertedKeyLocalizer: this.invertedKeyLocalizer,
            keyLocalizerCache: this.keyLocalizerCache,
            player: this.player?.toJson(),

            // transient info that is never read back but is useful for manual checks
            "$discarded": this.currentLoc.name,
        };
    }

    getLocation(id) {
        return this.locationRegistry[id];
    }

    toPrompt() {
        const nearbySpaces = this.getNearbyDiscoveredSpaces(2);
        const nearbyText = nearbySpaces.length > 0
            ? JSON.stringify(nearbySpaces, null, 3)
            : "[] (No other rooms discovered nearby)";

        return `[GAME STATE ${this.id}]

        [Player]
        ${this.player?.outputNPC().trim()}

        [Current Location]
        ${this.currentLoc.toText(this).trim()}

        [Nearby Discovered Spaces]
        ${nearbyText}

        [Your Hidden Knowledge (Do Not Reveal to Player)]
        ${this.internalState.trim() || 'No active traps or hidden schemes currently set.'}
        === END OF GAME STATE ===`;
    }

    localizeKeyForAI(key) {
        if (!(key in this.keyLocalizer)) {
            if (key in this.locationRegistry) {
                const location = this.locationRegistry[key];
                const name = location.name;
                return this.bindKey(name, key);
            } else if (key in this.npcRegistry) {
                const npc = this.npcRegistry[key];
                const name = npc.name;
                return this.bindKey(name, key);
            } else {
                return key;
            }
        }
        return this.keyLocalizer[key];
    }

    bindKey(name, key) {
        let cachedSuffix = 'A';
        if (key in this.keyLocalizerCache) {
            cachedSuffix = this.keyLocalizerCache[key];
            this.keyLocalizerCache[key] = rotateKey(cachedSuffix);
        }
        const localizedName = `${name} (${cachedSuffix})`;
        this.keyLocalizer[key] = localizedName;
        this.invertedKeyLocalizer[localizedName] = key;
        return localizedName;
    }

    getNearbyDiscoveredSpaces(maxDepth = 2) {
        const startId = this.locationId;
        if (!startId) return [];

        const queue = [{ id: startId, depth: 0 }];
        const visited = new Set([startId]);
        const nearbySpaces = [];

        while (queue.length > 0) {
            const { id, depth } = queue.shift();

            if (depth >= maxDepth) continue;

            const currentRoom = this.getLocation(id);
            if (!currentRoom || !currentRoom.exitIds) continue;

            // Iterate through your location's exit dictionary
            for (const direction in currentRoom.exitIds) {
                const targetUuid = currentRoom.exitIds[direction];

                // Ensure the destination exists, is registered, and hasn't been visited in this search
                if (targetUuid && this.locationRegistry[targetUuid] && !visited.has(targetUuid)) {
                    visited.add(targetUuid);

                    const targetRoom = this.locationRegistry[targetUuid];

                    // Match the localization strategy used in your toText() method
                    const aiFriendlyName = this.localizeKeyForAI ? this.localizeKeyForAI(targetUuid) : targetRoom.name;

                    nearbySpaces.push({
                        name: aiFriendlyName,
                        description: targetRoom.description || "",
                        distance: depth + 1
                    });

                    queue.push({ id: targetUuid, depth: depth + 1 });
                }
            }
        }

        return nearbySpaces;
    }
}

function rotateKey(currentId) {
    if (!currentId || typeof currentId !== 'string') return 'A';
    const chars = currentId.toUpperCase().split('');
    let i = chars.length - 1;
    while (i >= 0) {
        const charCode = chars[i].charCodeAt(0);

        if (charCode < 90) { // Less than 'Z', just bump it to the next letter
            chars[i] = String.fromCharCode(charCode + 1);
            return chars.join('');
        }
        chars[i] = 'A';
        i--;
    }
    chars.unshift('A');
    return chars.join('');
}
