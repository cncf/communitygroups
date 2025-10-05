import { RuntimeNodeInstrumentationConfig } from '../types';
import { Meter } from '@opentelemetry/api';
import { BaseCollector } from './baseCollector';
export declare class GCCollector extends BaseCollector {
    private _gcDurationByKindHistogram?;
    private _observer;
    constructor(config: RuntimeNodeInstrumentationConfig | undefined, namePrefix: string);
    updateMetricInstruments(meter: Meter): void;
    internalEnable(): void;
    internalDisable(): void;
}
//# sourceMappingURL=gcCollector.d.ts.map