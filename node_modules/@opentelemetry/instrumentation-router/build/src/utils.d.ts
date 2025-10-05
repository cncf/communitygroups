import * as types from './internal-types';
export declare const isInternal: (fn: Function) => boolean;
export declare const renameHttpSpan: (span?: types.InstrumentationSpan, method?: string, route?: string) => void;
export declare const once: (fn: Function) => () => void;
//# sourceMappingURL=utils.d.ts.map