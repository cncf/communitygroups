import { Span } from '@opentelemetry/api';
import type { FastifyReply } from 'fastify';
import { spanRequestSymbol } from './constants';
export type HandlerOriginal = (() => Promise<unknown>) & (() => void);
export type PluginFastifyReply = FastifyReply & {
    [spanRequestSymbol]?: Span[];
};
//# sourceMappingURL=internal-types.d.ts.map