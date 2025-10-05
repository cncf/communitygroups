"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeapSpacesSizeAndUsedCollector = exports.metricNames = exports.V8HeapSpaceMetrics = void 0;
const baseCollector_1 = require("./baseCollector");
const v8 = require("node:v8");
const attributes_1 = require("../consts/attributes");
var V8HeapSpaceMetrics;
(function (V8HeapSpaceMetrics) {
    V8HeapSpaceMetrics["heapLimit"] = "memory.heap.limit";
    V8HeapSpaceMetrics["used"] = "memory.heap.used";
    V8HeapSpaceMetrics["available"] = "memory.heap.space.available_size";
    V8HeapSpaceMetrics["physical"] = "memory.heap.space.physical_size";
})(V8HeapSpaceMetrics = exports.V8HeapSpaceMetrics || (exports.V8HeapSpaceMetrics = {}));
exports.metricNames = {
    [V8HeapSpaceMetrics.heapLimit]: {
        description: 'Total heap memory size pre-allocated.',
    },
    [V8HeapSpaceMetrics.used]: {
        description: 'Heap Memory size allocated.',
    },
    [V8HeapSpaceMetrics.available]: {
        description: 'Heap space available size.',
    },
    [V8HeapSpaceMetrics.physical]: {
        description: 'Committed size of a heap space.',
    },
};
class HeapSpacesSizeAndUsedCollector extends baseCollector_1.BaseCollector {
    constructor(config = {}, namePrefix) {
        super(config, namePrefix);
    }
    updateMetricInstruments(meter) {
        const heapLimit = meter.createObservableGauge(`${this.namePrefix}.${V8HeapSpaceMetrics.heapLimit}`, {
            description: exports.metricNames[V8HeapSpaceMetrics.heapLimit].description,
            unit: 'By',
        });
        const heapSpaceUsed = meter.createObservableGauge(`${this.namePrefix}.${V8HeapSpaceMetrics.used}`, {
            description: exports.metricNames[V8HeapSpaceMetrics.used].description,
            unit: 'By',
        });
        const heapSpaceAvailable = meter.createObservableGauge(`${this.namePrefix}.${V8HeapSpaceMetrics.available}`, {
            description: exports.metricNames[V8HeapSpaceMetrics.available].description,
            unit: 'By',
        });
        const heapSpacePhysical = meter.createObservableGauge(`${this.namePrefix}.${V8HeapSpaceMetrics.physical}`, {
            description: exports.metricNames[V8HeapSpaceMetrics.physical].description,
            unit: 'By',
        });
        const heapSpaceNameAttributeName = `${this.namePrefix}.${attributes_1.ATTR_V8JS_HEAP_SPACE_NAME}`;
        meter.addBatchObservableCallback(observableResult => {
            if (!this._config.enabled)
                return;
            const data = this.scrape();
            if (data === undefined)
                return;
            for (const space of data) {
                const spaceName = space.space_name;
                observableResult.observe(heapLimit, space.space_size, {
                    [heapSpaceNameAttributeName]: spaceName,
                });
                observableResult.observe(heapSpaceUsed, space.space_used_size, {
                    [heapSpaceNameAttributeName]: spaceName,
                });
                observableResult.observe(heapSpaceAvailable, space.space_available_size, {
                    [heapSpaceNameAttributeName]: spaceName,
                });
                observableResult.observe(heapSpacePhysical, space.physical_space_size, {
                    [heapSpaceNameAttributeName]: spaceName,
                });
            }
        }, [heapLimit, heapSpaceUsed, heapSpaceAvailable, heapSpacePhysical]);
    }
    internalEnable() { }
    internalDisable() { }
    scrape() {
        return v8.getHeapSpaceStatistics();
    }
}
exports.HeapSpacesSizeAndUsedCollector = HeapSpacesSizeAndUsedCollector;
//# sourceMappingURL=heapSpacesSizeAndUsedCollector.js.map