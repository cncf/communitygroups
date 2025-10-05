import { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
export declare class ContainerDetector implements ResourceDetector {
    readonly CONTAINER_ID_LENGTH = 64;
    readonly DEFAULT_CGROUP_V1_PATH = "/proc/self/cgroup";
    readonly DEFAULT_CGROUP_V2_PATH = "/proc/self/mountinfo";
    readonly UTF8_UNICODE = "utf8";
    readonly HOSTNAME = "hostname";
    readonly MARKING_PREFIX: string[];
    readonly CRIO = "crio-";
    readonly CRI_CONTAINERD = "cri-containerd-";
    readonly DOCKER = "docker-";
    readonly HEX_STRING_REGEX: RegExp;
    private static readFileAsync;
    detect(): DetectedResource;
    private _getContainerIdWithSuppressedTracing;
    private _getContainerIdV1;
    private _getContainerIdV2;
    private _getContainerId;
}
export declare const containerDetector: ContainerDetector;
//# sourceMappingURL=ContainerDetector.d.ts.map