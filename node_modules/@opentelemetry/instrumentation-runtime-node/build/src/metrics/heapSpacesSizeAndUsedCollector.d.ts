import { RuntimeNodeInstrumentationConfig } from '../types';
import { Meter } from '@opentelemetry/api';
import { BaseCollector } from './baseCollector';
export declare enum V8HeapSpaceMetrics {
    heapLimit = "memory.heap.limit",
    used = "memory.heap.used",
    available = "memory.heap.space.available_size",
    physical = "memory.heap.space.physical_size"
}
export declare const metricNames: Record<V8HeapSpaceMetrics, {
    description: string;
}>;
export declare class HeapSpacesSizeAndUsedCollector extends BaseCollector {
    constructor(config: RuntimeNodeInstrumentationConfig | undefined, namePrefix: string);
    updateMetricInstruments(meter: Meter): void;
    internalEnable(): void;
    internalDisable(): void;
    private scrape;
}
//# sourceMappingURL=heapSpacesSizeAndUsedCollector.d.ts.map