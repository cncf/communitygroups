import { Span, Tracer } from '@opentelemetry/api';
import { RequestMetadata, ServiceExtension } from './ServiceExtension';
import { NormalizedRequest, NormalizedResponse, AwsSdkInstrumentationConfig } from '../types';
export declare class SecretsManagerServiceExtension implements ServiceExtension {
    requestPreSpanHook(request: NormalizedRequest, _config: AwsSdkInstrumentationConfig): RequestMetadata;
    responseHook(response: NormalizedResponse, span: Span, tracer: Tracer, config: AwsSdkInstrumentationConfig): void;
}
//# sourceMappingURL=secretsmanager.d.ts.map