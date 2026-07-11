'use strict';

import { Colony } from '../colony';

export abstract class HiveCluster {
    colony: Colony;
    room: Room;
    pos: RoomPosition;
    name: string;
    ref: string;

    constructor(colony: Colony, headStructure: { pos: RoomPosition }, name: string) {
        this.colony = colony;
        this.room = colony.room;
        this.pos = headStructure.pos;
        this.name = name;
        this.ref = `${colony.name}>${name}`;
    }

    abstract refresh(): void;
    abstract init(): void;
    abstract run(): void;
}