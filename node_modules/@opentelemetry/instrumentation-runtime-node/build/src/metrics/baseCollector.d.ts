import { MetricCollector } from '../types/metricCollector';
import { Meter } from '@opentelemetry/api';
import { RuntimeNodeInstrumentationConfig } from '../types';
export declare abstract class BaseCollector implements MetricCollector {
    protected _config: RuntimeNodeInstrumentationConfig;
    protected namePrefix: string;
    protected constructor(config: RuntimeNodeInstrumentationConfig | undefined, namePrefix: string);
    disable(): void;
    enable(): void;
    abstract updateMetricInstruments(meter: Meter): void;
    protected abstract internalEnable(): void;
    protected abstract internalDisable(): void;
}
//# sourceMappingURL=baseCollector.d.ts.map