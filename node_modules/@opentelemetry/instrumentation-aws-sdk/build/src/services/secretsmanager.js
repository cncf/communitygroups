"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsManagerServiceExtension = void 0;
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
class SecretsManagerServiceExtension {
    requestPreSpanHook(request, _config) {
        const secretId = request.commandInput?.SecretId;
        const spanKind = api_1.SpanKind.CLIENT;
        let spanName;
        const spanAttributes = {};
        if (typeof secretId === 'string' &&
            secretId.startsWith('arn:aws:secretsmanager:')) {
            spanAttributes[semconv_1.ATTR_AWS_SECRETSMANAGER_SECRET_ARN] = secretId;
        }
        return {
            isIncoming: false,
            spanAttributes,
            spanKind,
            spanName,
        };
    }
    responseHook(response, span, tracer, config) {
        const secretArn = response.data?.ARN;
        if (secretArn) {
            span.setAttribute(semconv_1.ATTR_AWS_SECRETSMANAGER_SECRET_ARN, secretArn);
        }
    }
}
exports.SecretsManagerServiceExtension = SecretsManagerServiceExtension;
//# sourceMappingURL=secretsmanager.js.map