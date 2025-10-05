import { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
/**
 * The AzureAppServiceDetector can be used to detect if a process is running in an Azure App Service
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
declare class AzureAppServiceDetector implements ResourceDetector {
    detect(): DetectedResource;
}
export declare const azureAppServiceDetector: AzureAppServiceDetector;
export {};
//# sourceMappingURL=AzureAppServiceDetector.d.ts.map