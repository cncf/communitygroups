import type * as oracledbTypes from 'oracledb';
import type * as api from '@opentelemetry/api';
import { SpanConnectionConfig } from './types';
export interface InstrumentationContext {
    span: api.Span;
}
export interface TraceSpanData {
    operation: string;
    error?: oracledbTypes.DBError;
    connectLevelConfig: SpanConnectionConfig;
    callLevelConfig?: SpanCallLevelConfig;
    additionalConfig?: any;
    fn: Function;
    args?: any[];
    /**
     * This value is filled by instrumented module inside 'onEnterFn',
     * 'onBeginRoundTrip' hook functions, which is passed back by oracledb module
     * in 'onExitFn' and 'onEndRoundTrip' hook functions respectively.
     */
    userContext: InstrumentationContext;
}
export interface SpanCallLevelConfig {
    statement?: string;
    operation?: string;
    values?: any[];
}
//# sourceMappingURL=internal-types.d.ts.map