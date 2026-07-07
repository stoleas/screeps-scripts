'use strict';

// Colony abstraction adapted from Overmind's Colony.ts.

export enum ColonyStage {
    Larva = 0,  // No storage (RCL 1-3)
    Pupa = 1,   // Has storage but RCL < 8
    Adult = 2,  // RCL 8
}

export class Colony {
    name: string;
    room: Room;
    controller: StructureController;
    spawns: StructureSpawn[];
    sources: Source[];
    storage: StructureStorage | undefined;
    stage: ColonyStage;
    level: number;
    creeps: Creep[];

    constructor(room: Room) {
        this.name = room.name;
        this.room = room;
        this.controller = room.controller!;
        this.spawns = room.find(FIND_MY_SPAWNS);
        this.sources = room.find(FIND_SOURCES);
        this.storage = room.storage;
        this.level = room.controller ? room.controller.level : 0;
        this.creeps = _.filter(Game.creeps, (c: Creep) => c.memory.colony === room.name);
        this.stage = this.storage ? (this.level >= 8 ? ColonyStage.Adult : ColonyStage.Pupa) : ColonyStage.Larva;
    }

    refresh(): void {
        this.room = Game.rooms[this.name];
        if (!this.room) return;
        this.controller = this.room.controller!;
        this.spawns = this.room.find(FIND_MY_SPAWNS);
        this.sources = this.room.find(FIND_SOURCES);
        this.storage = this.room.storage;
        this.level = this.controller ? this.controller.level : 0;
        this.creeps = _.filter(Game.creeps, (c: Creep) => c.memory.colony === this.name);
        this.stage = this.storage ? (this.level >= 8 ? ColonyStage.Adult : ColonyStage.Pupa) : ColonyStage.Larva;
    }
}