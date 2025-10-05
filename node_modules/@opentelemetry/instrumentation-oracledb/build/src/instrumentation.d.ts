import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { OracleInstrumentationConfig } from './types';
export declare class OracleInstrumentation extends InstrumentationBase {
    private _tmHandler;
    constructor(config?: OracleInstrumentationConfig);
    protected init(): InstrumentationNodeModuleDefinition[];
    setConfig(config?: OracleInstrumentationConfig): void;
}
//# sourceMappingURL=instrumentation.d.ts.map