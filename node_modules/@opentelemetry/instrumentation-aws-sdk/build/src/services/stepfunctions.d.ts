import { RequestMetadata, ServiceExtension } from './ServiceExtension';
import { NormalizedRequest, AwsSdkInstrumentationConfig } from '../types';
export declare class StepFunctionsServiceExtension implements ServiceExtension {
    requestPreSpanHook(request: NormalizedRequest, _config: AwsSdkInstrumentationConfig): RequestMetadata;
}
//# sourceMappingURL=stepfunctions.d.ts.map