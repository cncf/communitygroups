import { RuntimeNodeInstrumentationConfig } from '../types';
import { Meter } from '@opentelemetry/api';
import { BaseCollector } from './baseCollector';
export declare const ATTR_NODEJS_EVENT_LOOP_UTILIZATION = "eventloop.utilization";
export declare class EventLoopUtilizationCollector extends BaseCollector {
    private _lastValue?;
    constructor(config: RuntimeNodeInstrumentationConfig | undefined, namePrefix: string);
    updateMetricInstruments(meter: Meter): void;
    protected internalDisable(): void;
    protected internalEnable(): void;
}
//# sourceMappingURL=eventLoopUtilizationCollector.d.ts.map