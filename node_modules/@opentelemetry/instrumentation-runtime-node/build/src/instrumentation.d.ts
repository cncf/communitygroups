import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { RuntimeNodeInstrumentationConfig } from './types';
export declare class RuntimeNodeInstrumentation extends InstrumentationBase<RuntimeNodeInstrumentationConfig> {
    private readonly _collectors;
    constructor(config?: RuntimeNodeInstrumentationConfig);
    _updateMetricInstruments(): void;
    init(): void;
    enable(): void;
    disable(): void;
}
//# sourceMappingURL=instrumentation.d.ts.map