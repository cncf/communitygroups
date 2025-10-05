import { RuntimeNodeInstrumentationConfig } from '../types';
import { Meter } from '@opentelemetry/api';
import { BaseCollector } from './baseCollector';
declare enum NodeJsEventLoopDelayAttributes {
    min = "eventloop.delay.min",
    max = "eventloop.delay.max",
    mean = "eventloop.delay.mean",
    stddev = "eventloop.delay.stddev",
    p50 = "eventloop.delay.p50",
    p90 = "eventloop.delay.p90",
    p99 = "eventloop.delay.p99"
}
export declare const metricNames: Record<NodeJsEventLoopDelayAttributes, {
    description: string;
}>;
export interface EventLoopLagInformation {
    min: number;
    max: number;
    mean: number;
    stddev: number;
    p50: number;
    p90: number;
    p99: number;
}
export declare class EventLoopDelayCollector extends BaseCollector {
    private _histogram;
    constructor(config: RuntimeNodeInstrumentationConfig | undefined, namePrefix: string);
    updateMetricInstruments(meter: Meter): void;
    internalEnable(): void;
    internalDisable(): void;
    private scrape;
    private checkNan;
}
export {};
//# sourceMappingURL=eventLoopDelayCollector.d.ts.map