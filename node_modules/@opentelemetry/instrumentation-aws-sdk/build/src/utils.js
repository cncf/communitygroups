"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindPromise = exports.extractAttributesFromNormalizedRequest = exports.normalizeV3Request = exports.removeSuffixFromStringIfExists = void 0;
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
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const enums_1 = require("./enums");
const removeSuffixFromStringIfExists = (str, suffixToRemove) => {
    const suffixLength = suffixToRemove.length;
    return str?.slice(-suffixLength) === suffixToRemove
        ? str.slice(0, str.length - suffixLength)
        : str;
};
exports.removeSuffixFromStringIfExists = removeSuffixFromStringIfExists;
const normalizeV3Request = (serviceName, commandNameWithSuffix, commandInput, region) => {
    return {
        serviceName: serviceName?.replace(/\s+/g, ''),
        commandName: (0, exports.removeSuffixFromStringIfExists)(commandNameWithSuffix, 'Command'),
        commandInput,
        region,
    };
};
exports.normalizeV3Request = normalizeV3Request;
const extractAttributesFromNormalizedRequest = (normalizedRequest) => {
    return {
        [semantic_conventions_1.SEMATTRS_RPC_SYSTEM]: 'aws-api',
        [semantic_conventions_1.SEMATTRS_RPC_METHOD]: normalizedRequest.commandName,
        [semantic_conventions_1.SEMATTRS_RPC_SERVICE]: normalizedRequest.serviceName,
        [enums_1.AttributeNames.CLOUD_REGION]: normalizedRequest.region,
    };
};
exports.extractAttributesFromNormalizedRequest = extractAttributesFromNormalizedRequest;
const bindPromise = (target, contextForCallbacks, rebindCount = 1) => {
    const origThen = target.then;
    target.then = function (onFulfilled, onRejected) {
        const newOnFulfilled = api_1.context.bind(contextForCallbacks, onFulfilled);
        const newOnRejected = api_1.context.bind(contextForCallbacks, onRejected);
        const patchedPromise = origThen.call(this, newOnFulfilled, newOnRejected);
        return rebindCount > 1
            ? (0, exports.bindPromise)(patchedPromise, contextForCallbacks, rebindCount - 1)
            : patchedPromise;
    };
    return target;
};
exports.bindPromise = bindPromise;
//# sourceMappingURL=utils.js.map