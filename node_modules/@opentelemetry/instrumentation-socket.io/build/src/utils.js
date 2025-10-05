"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRoomsAttributeValue = exports.normalizeConfig = exports.isPromise = void 0;
const isPromise = (value) => {
    return typeof value?.then === 'function';
};
exports.isPromise = isPromise;
const normalizeConfig = (config) => {
    config = Object.assign({}, config);
    if (!Array.isArray(config.emitIgnoreEventList)) {
        config.emitIgnoreEventList = [];
    }
    if (!Array.isArray(config.onIgnoreEventList)) {
        config.onIgnoreEventList = [];
    }
    return config;
};
exports.normalizeConfig = normalizeConfig;
const extractRoomsAttributeValue = (self) => {
    let rooms = self.rooms ||
        self._rooms ||
        self.sockets?._rooms ||
        self.sockets?.rooms ||
        [];
    // Some of the attributes above are of Set type. Convert it.
    if (!Array.isArray(rooms)) {
        rooms = Array.from(rooms);
    }
    // only for v2: this.id is only set for v2. That's to mimic later versions which have this.id in the rooms Set.
    if (rooms.length === 0 && self.id) {
        rooms.push(self.id);
    }
    return rooms;
};
exports.extractRoomsAttributeValue = extractRoomsAttributeValue;
//# sourceMappingURL=utils.js.map