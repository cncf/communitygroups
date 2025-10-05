"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepFunctionsServiceExtension = void 0;
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
const semconv_1 = require("../semconv");
class StepFunctionsServiceExtension {
    requestPreSpanHook(request, _config) {
        const stateMachineArn = request.commandInput?.stateMachineArn;
        const activityArn = request.commandInput?.activityArn;
        const spanKind = api_1.SpanKind.CLIENT;
        const spanAttributes = {};
        if (stateMachineArn) {
            spanAttributes[semconv_1.ATTR_AWS_STEP_FUNCTIONS_STATE_MACHINE_ARN] =
                stateMachineArn;
        }
        if (activityArn) {
            spanAttributes[semconv_1.ATTR_AWS_STEP_FUNCTIONS_ACTIVITY_ARN] = activityArn;
        }
        return {
            isIncoming: false,
            spanAttributes,
            spanKind,
        };
    }
}
exports.StepFunctionsServiceExtension = StepFunctionsServiceExtension;
//# sourceMappingURL=stepfunctions.js.map