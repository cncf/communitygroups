import { RuntimeNodeInstrumentationConfig } from '../types';
import { Meter } from '@opentelemetry/api';
import { BaseCollector } from './baseCollector';
export declare const ATTR_NODEJS_EVENT_LOOP_TIME = "eventloop.time";
export declare class EventLoopTimeCollector extends BaseCollector {
    constructor(config: RuntimeNodeInstrumentationConfig | undefined, namePrefix: string);
    updateMetricInstruments(meter: Meter): void;
    protected internalDisable(): void;
    protected internalEnable(): void;
    private scrape;
}
//# sourceMappingURL=eventLoopTimeCollector.d.ts.map