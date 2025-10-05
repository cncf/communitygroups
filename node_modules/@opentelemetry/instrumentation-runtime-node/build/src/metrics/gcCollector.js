"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCCollector = void 0;
const api_1 = require("@opentelemetry/api");
const baseCollector_1 = require("./baseCollector");
const perf_hooks = require("node:perf_hooks");
const ATTR_NODEJS_GC_DURATION_SECONDS = 'gc.duration';
const DEFAULT_GC_DURATION_BUCKETS = [0.01, 0.1, 1, 10];
const kinds = [];
kinds[perf_hooks.constants.NODE_PERFORMANCE_GC_MAJOR] = 'major';
kinds[perf_hooks.constants.NODE_PERFORMANCE_GC_MINOR] = 'minor';
kinds[perf_hooks.constants.NODE_PERFORMANCE_GC_INCREMENTAL] = 'incremental';
kinds[perf_hooks.constants.NODE_PERFORMANCE_GC_WEAKCB] = 'weakcb';
class GCCollector extends baseCollector_1.BaseCollector {
    _gcDurationByKindHistogram;
    _observer;
    constructor(config = {}, namePrefix) {
        super(config, namePrefix);
        this._observer = new perf_hooks.PerformanceObserver(list => {
            if (!this._config.enabled)
                return;
            const entry = list.getEntries()[0];
            // Node < 16 uses entry.kind
            // Node >= 16 uses entry.detail.kind
            // See: https://nodejs.org/docs/latest-v16.x/api/deprecations.html#deprecations_dep0152_extension_performanceentry_properties
            // eslint-disable-next-line  @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const kind = entry.detail ? kinds[entry.detail.kind] : kinds[entry.kind];
            this._gcDurationByKindHistogram?.record(entry.duration / 1000, Object.assign({ [`${this.namePrefix}.gc.type`]: kind }));
        });
    }
    updateMetricInstruments(meter) {
        this._gcDurationByKindHistogram = meter.createHistogram(`${this.namePrefix}.${ATTR_NODEJS_GC_DURATION_SECONDS}`, {
            description: 'Garbage collection duration by kind, one of major, minor, incremental or weakcb.',
            unit: 's',
            valueType: api_1.ValueType.DOUBLE,
            advice: {
                explicitBucketBoundaries: DEFAULT_GC_DURATION_BUCKETS,
            },
        });
    }
    internalEnable() {
        this._observer.observe({ entryTypes: ['gc'] });
    }
    internalDisable() {
        this._observer.disconnect();
    }
}
exports.GCCollector = GCCollector;
//# sourceMappingURL=gcCollector.js.map