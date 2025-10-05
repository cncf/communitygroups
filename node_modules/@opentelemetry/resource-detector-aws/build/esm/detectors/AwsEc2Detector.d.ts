import { ResourceDetector, DetectedResource, DetectedResourceAttributes } from '@opentelemetry/resources';
/**
 * The AwsEc2Detector can be used to detect if a process is running in AWS EC2
 * and return resource attributes with metadata about the EC2 instance.
 */
declare class AwsEc2Detector implements ResourceDetector {
    /**
     * See https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-identity-documents.html
     * for documentation about the AWS instance identity document
     * and standard of IMDSv2.
     */
    readonly AWS_IDMS_ENDPOINT = "169.254.169.254";
    readonly AWS_INSTANCE_TOKEN_DOCUMENT_PATH = "/latest/api/token";
    readonly AWS_INSTANCE_IDENTITY_DOCUMENT_PATH = "/latest/dynamic/instance-identity/document";
    readonly AWS_INSTANCE_HOST_DOCUMENT_PATH = "/latest/meta-data/hostname";
    readonly AWS_METADATA_TTL_HEADER = "X-aws-ec2-metadata-token-ttl-seconds";
    readonly AWS_METADATA_TOKEN_HEADER = "X-aws-ec2-metadata-token";
    readonly MILLISECOND_TIME_OUT = 5000;
    detect(): DetectedResource;
    /**
     * Attempts to connect and obtain an AWS instance Identity document.
     */
    _gatherData(): Promise<DetectedResourceAttributes>;
    private _fetchToken;
    private _fetchIdentity;
    private _fetchHost;
    /**
     * Establishes an HTTP connection to AWS instance document url.
     * If the application is running on an EC2 instance, we should be able
     * to get back a valid JSON document. Parses that document and stores
     * the identity properties in a local map.
     */
    private _fetchString;
}
export declare const awsEc2Detector: AwsEc2Detector;
export {};
//# sourceMappingURL=AwsEc2Detector.d.ts.map