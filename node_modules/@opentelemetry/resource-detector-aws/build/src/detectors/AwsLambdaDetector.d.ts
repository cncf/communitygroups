import { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
/**
 * The AwsLambdaDetector can be used to detect if a process is running in AWS Lambda
 * and return a {@link Resource} populated with data about the environment.
 * Returns an empty Resource if detection fails.
 */
export declare class AwsLambdaDetector implements ResourceDetector {
    detect(): DetectedResource;
}
export declare const awsLambdaDetector: AwsLambdaDetector;
//# sourceMappingURL=AwsLambdaDetector.d.ts.map