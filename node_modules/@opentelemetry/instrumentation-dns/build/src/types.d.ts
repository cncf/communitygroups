import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export type IgnoreMatcher = string | RegExp | ((url: string) => boolean);
export interface DnsInstrumentationConfig extends InstrumentationConfig {
    ignoreHostnames?: IgnoreMatcher | IgnoreMatcher[];
}
//# sourceMappingURL=types.d.ts.map