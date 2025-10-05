import { DiagLogger, HrTime, Meter, Span, Tracer } from '@opentelemetry/api';
import { RequestMetadata, ServiceExtension } from './ServiceExtension';
import { AwsSdkInstrumentationConfig, NormalizedRequest, NormalizedResponse } from '../types';
export declare class BedrockRuntimeServiceExtension implements ServiceExtension {
    private tokenUsage;
    private operationDuration;
    updateMetricInstruments(meter: Meter): void;
    requestPreSpanHook(request: NormalizedRequest, config: AwsSdkInstrumentationConfig, diag: DiagLogger): RequestMetadata;
    private requestPreSpanHookConverse;
    private requestPreSpanHookInvokeModel;
    responseHook(response: NormalizedResponse, span: Span, tracer: Tracer, config: AwsSdkInstrumentationConfig, startTime: HrTime): any;
    private responseHookConverse;
    private responseHookConverseStream;
    private wrapConverseStreamResponse;
    private static setStopReason;
    private setUsage;
    private responseHookInvokeModel;
}
//# sourceMappingURL=bedrock-runtime.d.ts.map