
export class Location {

    constructor() {
        this.name = "";
    }

    fromJson(json) {
        this.name = json.name;
    }

    toJson() {
        return {
            name: this.name
        };
    }

    toText() {
        return `${this.name}`;
    }

    toTextFull() {

    }

}
