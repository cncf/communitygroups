"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqsServiceExtension = void 0;
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
const semconv_1 = require("../semconv");
const MessageAttributes_1 = require("./MessageAttributes");
class SqsServiceExtension {
    requestPreSpanHook(request, _config) {
        const queueUrl = this.extractQueueUrl(request.commandInput);
        const queueName = this.extractQueueNameFromUrl(queueUrl);
        let spanKind = api_1.SpanKind.CLIENT;
        let spanName;
        const spanAttributes = {
            [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'aws_sqs',
            [semconv_1.ATTR_MESSAGING_DESTINATION_NAME]: queueName,
            [semantic_conventions_1.ATTR_URL_FULL]: queueUrl,
        };
        let isIncoming = false;
        switch (request.commandName) {
            case 'ReceiveMessage':
                {
                    isIncoming = true;
                    spanKind = api_1.SpanKind.CONSUMER;
                    spanName = `${queueName} receive`;
                    spanAttributes[semconv_1.ATTR_MESSAGING_OPERATION_TYPE] = 'receive';
                    request.commandInput.MessageAttributeNames =
                        (0, MessageAttributes_1.addPropagationFieldsToAttributeNames)(request.commandInput.MessageAttributeNames, api_1.propagation.fields());
                }
                break;
            case 'SendMessage':
            case 'SendMessageBatch':
                spanKind = api_1.SpanKind.PRODUCER;
                spanName = `${queueName} send`;
                break;
        }
        return {
            isIncoming,
            spanAttributes,
            spanKind,
            spanName,
        };
    }
    requestPostSpanHook = (request) => {
        switch (request.commandName) {
            case 'SendMessage':
                {
                    const origMessageAttributes = request.commandInput['MessageAttributes'] ?? {};
                    if (origMessageAttributes) {
                        request.commandInput['MessageAttributes'] =
                            (0, MessageAttributes_1.injectPropagationContext)(origMessageAttributes);
                    }
                }
                break;
            case 'SendMessageBatch':
                {
                    const entries = request.commandInput?.Entries;
                    if (Array.isArray(entries)) {
                        entries.forEach((messageParams) => {
                            messageParams.MessageAttributes = (0, MessageAttributes_1.injectPropagationContext)(messageParams.MessageAttributes ?? {});
                        });
                    }
                }
                break;
        }
    };
    responseHook = (response, span, _tracer, config) => {
        switch (response.request.commandName) {
            case 'SendMessage':
                span.setAttribute(semconv_1.ATTR_MESSAGING_MESSAGE_ID, response?.data?.MessageId);
                break;
            case 'SendMessageBatch':
                // TODO: How should this be handled?
                break;
            case 'ReceiveMessage': {
                const messages = response?.data?.Messages || [];
                span.setAttribute(semconv_1.ATTR_MESSAGING_BATCH_MESSAGE_COUNT, messages.length);
                for (const message of messages) {
                    const propagatedContext = api_1.propagation.extract(api_1.ROOT_CONTEXT, (0, MessageAttributes_1.extractPropagationContext)(message, config.sqsExtractContextPropagationFromPayload), MessageAttributes_1.contextGetter);
                    const spanContext = api_1.trace.getSpanContext(propagatedContext);
                    if (spanContext) {
                        span.addLink({
                            context: spanContext,
                            attributes: {
                                [semconv_1.ATTR_MESSAGING_MESSAGE_ID]: message.MessageId,
                            },
                        });
                    }
                }
                break;
            }
        }
    };
    extractQueueUrl = (commandInput) => {
        return commandInput?.QueueUrl;
    };
    extractQueueNameFromUrl = (queueUrl) => {
        if (!queueUrl)
            return undefined;
        const segments = queueUrl.split('/');
        if (segments.length === 0)
            return undefined;
        return segments[segments.length - 1];
    };
}
exports.SqsServiceExtension = SqsServiceExtension;
//# sourceMappingURL=sqs.js.map