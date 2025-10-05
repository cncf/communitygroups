"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLoopDelayCollector = exports.metricNames = void 0;
const perf_hooks = require("node:perf_hooks");
const baseCollector_1 = require("./baseCollector");
var NodeJsEventLoopDelayAttributes;
(function (NodeJsEventLoopDelayAttributes) {
    NodeJsEventLoopDelayAttributes["min"] = "eventloop.delay.min";
    NodeJsEventLoopDelayAttributes["max"] = "eventloop.delay.max";
    NodeJsEventLoopDelayAttributes["mean"] = "eventloop.delay.mean";
    NodeJsEventLoopDelayAttributes["stddev"] = "eventloop.delay.stddev";
    NodeJsEventLoopDelayAttributes["p50"] = "eventloop.delay.p50";
    NodeJsEventLoopDelayAttributes["p90"] = "eventloop.delay.p90";
    NodeJsEventLoopDelayAttributes["p99"] = "eventloop.delay.p99";
})(NodeJsEventLoopDelayAttributes || (NodeJsEventLoopDelayAttributes = {}));
exports.metricNames = {
    [NodeJsEventLoopDelayAttributes.min]: {
        description: 'Event loop minimum delay.',
    },
    [NodeJsEventLoopDelayAttributes.max]: {
        description: 'Event loop maximum delay.',
    },
    [NodeJsEventLoopDelayAttributes.mean]: {
        description: 'Event loop mean delay.',
    },
    [NodeJsEventLoopDelayAttributes.stddev]: {
        description: 'Event loop standard deviation delay.',
    },
    [NodeJsEventLoopDelayAttributes.p50]: {
        description: 'Event loop 50 percentile delay.',
    },
    [NodeJsEventLoopDelayAttributes.p90]: {
        description: 'Event loop 90 percentile delay.',
    },
    [NodeJsEventLoopDelayAttributes.p99]: {
        description: 'Event loop 99 percentile delay.',
    },
};
class EventLoopDelayCollector extends baseCollector_1.BaseCollector {
    _histogram;
    constructor(config = {}, namePrefix) {
        super(config, namePrefix);
        this._histogram = perf_hooks.monitorEventLoopDelay({
            resolution: config.monitoringPrecision,
        });
    }
    updateMetricInstruments(meter) {
        const delayMin = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.min}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.min].description,
            unit: 's',
        });
        const delayMax = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.max}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.max].description,
            unit: 's',
        });
        const delayMean = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.mean}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.mean].description,
            unit: 's',
        });
        const delayStddev = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.stddev}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.stddev].description,
            unit: 's',
        });
        const delayp50 = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.p50}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.p50].description,
            unit: 's',
        });
        const delayp90 = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.p90}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.p90].description,
            unit: 's',
        });
        const delayp99 = meter.createObservableGauge(`${this.namePrefix}.${NodeJsEventLoopDelayAttributes.p99}`, {
            description: exports.metricNames[NodeJsEventLoopDelayAttributes.p99].description,
            unit: 's',
        });
        meter.addBatchObservableCallback(async (observableResult) => {
            if (!this._config.enabled)
                return;
            const data = this.scrape();
            if (data === undefined)
                return;
            if (this._histogram.count < 5)
                return; // Don't return histogram data if we have less than 5 samples
            observableResult.observe(delayMin, data.min);
            observableResult.observe(delayMax, data.max);
            observableResult.observe(delayMean, data.mean);
            observableResult.observe(delayStddev, data.stddev);
            observableResult.observe(delayp50, data.p50);
            observableResult.observe(delayp90, data.p90);
            observableResult.observe(delayp99, data.p99);
            this._histogram.reset();
        }, [delayMin, delayMax, delayMean, delayStddev, delayp50, delayp90, delayp99]);
    }
    internalEnable() {
        this._histogram.enable();
    }
    internalDisable() {
        this._histogram.disable();
    }
    scrape() {
        return {
            min: this.checkNan(this._histogram.min / 1e9),
            max: this.checkNan(this._histogram.max / 1e9),
            mean: this.checkNan(this._histogram.mean / 1e9),
            stddev: this.checkNan(this._histogram.stddev / 1e9),
            p50: this.checkNan(this._histogram.percentile(50) / 1e9),
            p90: this.checkNan(this._histogram.percentile(90) / 1e9),
            p99: this.checkNan(this._histogram.percentile(99) / 1e9),
        };
    }
    checkNan(value) {
        return isNaN(value) ? 0 : value;
    }
}
exports.EventLoopDelayCollector = EventLoopDelayCollector;
//# sourceMappingURL=eventLoopDelayCollector.js.map