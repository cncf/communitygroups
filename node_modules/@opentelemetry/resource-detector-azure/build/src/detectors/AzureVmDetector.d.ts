import { ResourceDetector, DetectedResource, DetectedResourceAttributes } from '@opentelemetry/resources';
/**
 * The AzureVmDetector can be used to detect if a process is running in an Azure VM.
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
declare class AzureVmResourceDetector implements ResourceDetector {
    detect(): DetectedResource;
    getAzureVmMetadata(): Promise<DetectedResourceAttributes>;
}
export declare const azureVmDetector: AzureVmResourceDetector;
export {};
//# sourceMappingURL=AzureVmDetector.d.ts.map