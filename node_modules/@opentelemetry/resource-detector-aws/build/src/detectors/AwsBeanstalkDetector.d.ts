import { ResourceDetector, DetectedResource, DetectedResourceAttributes } from '@opentelemetry/resources';
export declare class AwsBeanstalkDetector implements ResourceDetector {
    BEANSTALK_CONF_PATH: string;
    private static readFileAsync;
    private static fileAccessAsync;
    constructor();
    detect(): DetectedResource;
    /**
     * Async resource attributes for AWS Beanstalk configuration read from file.
     */
    _gatherData(): Promise<DetectedResourceAttributes>;
}
export declare const awsBeanstalkDetector: AwsBeanstalkDetector;
//# sourceMappingURL=AwsBeanstalkDetector.d.ts.map