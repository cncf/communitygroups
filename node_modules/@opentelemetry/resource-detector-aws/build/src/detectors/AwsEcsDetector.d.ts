import { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
/**
 * The AwsEcsDetector can be used to detect if a process is running in AWS
 * ECS and return a {@link Resource} populated with data about the ECS
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 */
export declare class AwsEcsDetector implements ResourceDetector {
    static readonly CONTAINER_ID_LENGTH = 64;
    static readonly CONTAINER_ID_LENGTH_MIN = 32;
    static readonly DEFAULT_CGROUP_PATH = "/proc/self/cgroup";
    private static readFileAsync;
    detect(): DetectedResource;
    private _getAttributes;
    private _gatherData;
    /**
     * Read container ID from cgroup file
     * In ECS, even if we fail to find target file
     * or target file does not contain container ID
     * we do not throw an error but throw warning message
     * and then return undefined.
     */
    private _getContainerId;
    private _extractPrimaryEcsContainerId;
    private _extractLastSegmentContainerId;
    private _extractLegacyContainerId;
    /**
     * Add metadata-v4-related resource attributes to `data` (in-place)
     */
    private static _addMetadataV4Attrs;
    private static _addLogAttrs;
    private static _getAccountFromArn;
    private static _getRegionFromArn;
    private static _getUrlAsJson;
}
export declare const awsEcsDetector: AwsEcsDetector;
//# sourceMappingURL=AwsEcsDetector.d.ts.map