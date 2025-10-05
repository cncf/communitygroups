import { ResourceDetectionConfig, ResourceDetector, DetectedResource } from '@opentelemetry/resources';
/**
 * The GcpDetector can be used to detect if a process is running in the Google
 * Cloud Platform and return a {@link Resource} populated with metadata about
 * the instance. Returns an empty Resource if detection fails.
 */
declare class GcpDetector implements ResourceDetector {
    detect(_config?: ResourceDetectionConfig): DetectedResource;
    /**
     * Asynchronously gather GCP cloud metadata.
     */
    private _getAttributes;
    /** Gets project id from GCP project metadata. */
    private _getProjectId;
    /** Gets instance id from GCP instance metadata. */
    private _getInstanceId;
    /** Gets zone from GCP instance metadata. */
    private _getZone;
    /** Gets cluster name from GCP instance metadata. */
    private _getClusterName;
    /** Gets hostname from GCP instance metadata. */
    private _getHostname;
}
export declare const gcpDetector: GcpDetector;
export {};
//# sourceMappingURL=GcpDetector.d.ts.map