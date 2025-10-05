import { Meter } from '@opentelemetry/api';
export interface MetricCollector {
    updateMetricInstruments(meter: Meter): void;
    enable(): void;
    disable(): void;
}
//# sourceMappingURL=metricCollector.d.ts.map