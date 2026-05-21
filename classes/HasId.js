
export class HasId {

    constructor() {
        this.id = crypto.randomUUID();
    }

    fromJson(json) {
        this.id = json.id;
    }

    toJson() {
        return {
            id: this.id,
        };
    }

}
