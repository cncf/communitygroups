"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSocketIoPath = exports.SocketIoInstrumentationAttributes = exports.SocketIoInstrumentation = void 0;
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var socket_io_1 = require("./socket.io");
Object.defineProperty(exports, "SocketIoInstrumentation", { enumerable: true, get: function () { return socket_io_1.SocketIoInstrumentation; } });
var AttributeNames_1 = require("./AttributeNames");
Object.defineProperty(exports, "SocketIoInstrumentationAttributes", { enumerable: true, get: function () { return AttributeNames_1.SocketIoInstrumentationAttributes; } });
var types_1 = require("./types");
Object.defineProperty(exports, "defaultSocketIoPath", { enumerable: true, get: function () { return types_1.defaultSocketIoPath; } });
//# sourceMappingURL=index.js.map