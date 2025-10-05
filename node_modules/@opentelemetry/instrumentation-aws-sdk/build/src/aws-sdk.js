"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsInstrumentation = void 0;
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
const core_1 = require("@opentelemetry/core");
const enums_1 = require("./enums");
const services_1 = require("./services");
/** @knipignore */
const version_1 = require("./version");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const utils_1 = require("./utils");
const propwrap_1 = require("./propwrap");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const V3_CLIENT_CONFIG_KEY = Symbol('opentelemetry.instrumentation.aws-sdk.client.config');
class AwsInstrumentation extends instrumentation_1.InstrumentationBase {
    static component = 'aws-sdk';
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        const v3MiddlewareStackFileOldVersions = new instrumentation_1.InstrumentationNodeModuleFile('@aws-sdk/middleware-stack/dist/cjs/MiddlewareStack.js', ['>=3.1.0 <3.35.0'], this.patchV3ConstructStack.bind(this), this.unpatchV3ConstructStack.bind(this));
        const v3MiddlewareStackFileNewVersions = new instrumentation_1.InstrumentationNodeModuleFile('@aws-sdk/middleware-stack/dist-cjs/MiddlewareStack.js', ['>=3.35.0'], this.patchV3ConstructStack.bind(this), this.unpatchV3ConstructStack.bind(this));
        // as for aws-sdk v3.13.1, constructStack is exported from @aws-sdk/middleware-stack as
        // getter instead of function, which fails shimmer.
        // so we are patching the MiddlewareStack.js file directly to get around it.
        const v3MiddlewareStack = new instrumentation_1.InstrumentationNodeModuleDefinition('@aws-sdk/middleware-stack', ['^3.1.0'], undefined, undefined, [v3MiddlewareStackFileOldVersions, v3MiddlewareStackFileNewVersions]);
        // Patch for @smithy/middleware-stack for @aws-sdk/* packages v3.363.0+.
        // As of @smithy/middleware-stack@2.1.0 `constructStack` is only available
        // as a getter, so we cannot use `this._wrap()`.
        const self = this;
        const v3SmithyMiddlewareStack = new instrumentation_1.InstrumentationNodeModuleDefinition('@smithy/middleware-stack', ['>=2.0.0'], (moduleExports, moduleVersion) => {
            const newExports = (0, propwrap_1.propwrap)(moduleExports, 'constructStack', (orig) => {
                self._diag.debug('propwrapping aws-sdk v3 constructStack');
                return self._getV3ConstructStackPatch(moduleVersion, orig);
            });
            return newExports;
        });
        const v3SmithyClient = new instrumentation_1.InstrumentationNodeModuleDefinition('@aws-sdk/smithy-client', ['^3.1.0'], this.patchV3SmithyClient.bind(this), this.unpatchV3SmithyClient.bind(this));
        // patch for new @smithy/smithy-client for aws-sdk packages v3.363.0+
        const v3NewSmithyClient = new instrumentation_1.InstrumentationNodeModuleDefinition('@smithy/smithy-client', ['>=1.0.3'], this.patchV3SmithyClient.bind(this), this.unpatchV3SmithyClient.bind(this));
        return [
            v3MiddlewareStack,
            v3SmithyMiddlewareStack,
            v3SmithyClient,
            v3NewSmithyClient,
        ];
    }
    patchV3ConstructStack(moduleExports, moduleVersion) {
        this._wrap(moduleExports, 'constructStack', this._getV3ConstructStackPatch.bind(this, moduleVersion));
        return moduleExports;
    }
    unpatchV3ConstructStack(moduleExports) {
        this._unwrap(moduleExports, 'constructStack');
        return moduleExports;
    }
    patchV3SmithyClient(moduleExports) {
        this._wrap(moduleExports.Client.prototype, 'send', this._getV3SmithyClientSendPatch.bind(this));
        return moduleExports;
    }
    unpatchV3SmithyClient(moduleExports) {
        this._unwrap(moduleExports.Client.prototype, 'send');
        return moduleExports;
    }
    _startAwsV3Span(normalizedRequest, metadata) {
        const name = metadata.spanName ??
            `${normalizedRequest.serviceName}.${normalizedRequest.commandName}`;
        const newSpan = this.tracer.startSpan(name, {
            kind: metadata.spanKind ?? api_1.SpanKind.CLIENT,
            attributes: {
                ...(0, utils_1.extractAttributesFromNormalizedRequest)(normalizedRequest),
                ...metadata.spanAttributes,
            },
        });
        return newSpan;
    }
    _callUserPreRequestHook(span, request, moduleVersion) {
        const { preRequestHook } = this.getConfig();
        if (preRequestHook) {
            const requestInfo = {
                moduleVersion,
                request,
            };
            (0, instrumentation_1.safeExecuteInTheMiddle)(() => preRequestHook(span, requestInfo), (e) => {
                if (e)
                    api_1.diag.error(`${AwsInstrumentation.component} instrumentation: preRequestHook error`, e);
            }, true);
        }
    }
    _callUserResponseHook(span, response) {
        const { responseHook } = this.getConfig();
        if (!responseHook)
            return;
        const responseInfo = {
            response,
        };
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => responseHook(span, responseInfo), (e) => {
            if (e)
                api_1.diag.error(`${AwsInstrumentation.component} instrumentation: responseHook error`, e);
        }, true);
    }
    _callUserExceptionResponseHook(span, request, err) {
        const { exceptionHook } = this.getConfig();
        if (!exceptionHook)
            return;
        const requestInfo = {
            request,
        };
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => exceptionHook(span, requestInfo, err), (e) => {
            if (e)
                api_1.diag.error(`${AwsInstrumentation.component} instrumentation: exceptionHook error`, e);
        }, true);
    }
    _getV3ConstructStackPatch(moduleVersion, original) {
        const self = this;
        return function constructStack(...args) {
            const stack = original.apply(this, args);
            self.patchV3MiddlewareStack(moduleVersion, stack);
            return stack;
        };
    }
    _getV3SmithyClientSendPatch(original) {
        return function send(command, ...args) {
            command[V3_CLIENT_CONFIG_KEY] = this.config;
            return original.apply(this, [command, ...args]);
        };
    }
    patchV3MiddlewareStack(moduleVersion, middlewareStackToPatch) {
        if (!(0, instrumentation_1.isWrapped)(middlewareStackToPatch.resolve)) {
            this._wrap(middlewareStackToPatch, 'resolve', this._getV3MiddlewareStackResolvePatch.bind(this, moduleVersion));
        }
        // 'clone' and 'concat' functions are internally calling 'constructStack' which is in same
        // module, thus not patched, and we need to take care of it specifically.
        this._wrap(middlewareStackToPatch, 'clone', this._getV3MiddlewareStackClonePatch.bind(this, moduleVersion));
        this._wrap(middlewareStackToPatch, 'concat', this._getV3MiddlewareStackClonePatch.bind(this, moduleVersion));
    }
    _getV3MiddlewareStackClonePatch(moduleVersion, original) {
        const self = this;
        return function (...args) {
            const newStack = original.apply(this, args);
            self.patchV3MiddlewareStack(moduleVersion, newStack);
            return newStack;
        };
    }
    _getV3MiddlewareStackResolvePatch(moduleVersion, original) {
        const self = this;
        return function (_handler, awsExecutionContext) {
            const origHandler = original.call(this, _handler, awsExecutionContext);
            const patchedHandler = function (command) {
                const clientConfig = command[V3_CLIENT_CONFIG_KEY];
                const regionPromise = clientConfig?.region?.();
                const serviceName = clientConfig?.serviceId ??
                    (0, utils_1.removeSuffixFromStringIfExists)(
                    // Use 'AWS' as a fallback serviceName to match type definition.
                    // In practice, `clientName` should always be set.
                    awsExecutionContext.clientName || 'AWS', 'Client');
                const commandName = awsExecutionContext.commandName ?? command.constructor?.name;
                const normalizedRequest = (0, utils_1.normalizeV3Request)(serviceName, commandName, command.input, undefined);
                const requestMetadata = self.servicesExtensions.requestPreSpanHook(normalizedRequest, self.getConfig(), self._diag);
                const startTime = (0, core_1.hrTime)();
                const span = self._startAwsV3Span(normalizedRequest, requestMetadata);
                const activeContextWithSpan = api_1.trace.setSpan(api_1.context.active(), span);
                const handlerPromise = new Promise((resolve, reject) => {
                    Promise.resolve(regionPromise)
                        .then(resolvedRegion => {
                        normalizedRequest.region = resolvedRegion;
                        span.setAttribute(enums_1.AttributeNames.CLOUD_REGION, resolvedRegion);
                    })
                        .catch(e => {
                        // there is nothing much we can do in this case.
                        // we'll just continue without region
                        api_1.diag.debug(`${AwsInstrumentation.component} instrumentation: failed to extract region from async function`, e);
                    })
                        .finally(() => {
                        self._callUserPreRequestHook(span, normalizedRequest, moduleVersion);
                        const resultPromise = api_1.context.with(activeContextWithSpan, () => {
                            self.servicesExtensions.requestPostSpanHook(normalizedRequest);
                            return self._callOriginalFunction(() => origHandler.call(this, command));
                        });
                        const promiseWithResponseLogic = resultPromise
                            .then(response => {
                            const requestId = response.output?.$metadata?.requestId;
                            if (requestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_ID, requestId);
                            }
                            const httpStatusCode = response.output?.$metadata?.httpStatusCode;
                            if (httpStatusCode) {
                                span.setAttribute(semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE, httpStatusCode);
                            }
                            const extendedRequestId = response.output?.$metadata?.extendedRequestId;
                            if (extendedRequestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_EXTENDED_ID, extendedRequestId);
                            }
                            const normalizedResponse = {
                                data: response.output,
                                request: normalizedRequest,
                                requestId: requestId,
                            };
                            const override = self.servicesExtensions.responseHook(normalizedResponse, span, self.tracer, self.getConfig(), startTime);
                            if (override) {
                                response.output = override;
                                normalizedResponse.data = override;
                            }
                            self._callUserResponseHook(span, normalizedResponse);
                            return response;
                        })
                            .catch(err => {
                            const requestId = err?.RequestId;
                            if (requestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_ID, requestId);
                            }
                            const httpStatusCode = err?.$metadata?.httpStatusCode;
                            if (httpStatusCode) {
                                span.setAttribute(semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE, httpStatusCode);
                            }
                            const extendedRequestId = err?.extendedRequestId;
                            if (extendedRequestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_EXTENDED_ID, extendedRequestId);
                            }
                            span.setStatus({
                                code: api_1.SpanStatusCode.ERROR,
                                message: err.message,
                            });
                            span.recordException(err);
                            self._callUserExceptionResponseHook(span, normalizedRequest, err);
                            throw err;
                        })
                            .finally(() => {
                            if (!requestMetadata.isStream) {
                                span.end();
                            }
                        });
                        promiseWithResponseLogic
                            .then(res => {
                            resolve(res);
                        })
                            .catch(err => reject(err));
                    });
                });
                return requestMetadata.isIncoming
                    ? (0, utils_1.bindPromise)(handlerPromise, activeContextWithSpan, 2)
                    : handlerPromise;
            };
            return patchedHandler;
        };
    }
    _callOriginalFunction(originalFunction) {
        if (this.getConfig().suppressInternalInstrumentation) {
            return api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), originalFunction);
        }
        else {
            return originalFunction();
        }
    }
    _updateMetricInstruments() {
        if (!this.servicesExtensions) {
            this.servicesExtensions = new services_1.ServicesExtensions();
        }
        this.servicesExtensions.updateMetricInstruments(this.meter);
    }
}
exports.AwsInstrumentation = AwsInstrumentation;
//# sourceMappingURL=aws-sdk.js.map