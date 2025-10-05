/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as fs from 'fs';
import * as util from 'util';
import { context, diag } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { extractContainerIdFromLine } from './utils';
import { ATTR_CONTAINER_ID } from '../semconv';
class ContainerDetector {
    CONTAINER_ID_LENGTH = 64;
    DEFAULT_CGROUP_V1_PATH = '/proc/self/cgroup';
    DEFAULT_CGROUP_V2_PATH = '/proc/self/mountinfo';
    UTF8_UNICODE = 'utf8';
    HOSTNAME = 'hostname';
    MARKING_PREFIX = ['containers', 'overlay-containers'];
    CRIO = 'crio-';
    CRI_CONTAINERD = 'cri-containerd-';
    DOCKER = 'docker-';
    HEX_STRING_REGEX = /^[a-f0-9]+$/i;
    static readFileAsync = util.promisify(fs.readFile);
    detect() {
        const attributes = {
            [ATTR_CONTAINER_ID]: this._getContainerIdWithSuppressedTracing(),
        };
        return { attributes };
    }
    async _getContainerIdWithSuppressedTracing() {
        return context.with(suppressTracing(context.active()), () => this._getContainerId());
    }
    async _getContainerIdV1() {
        const rawData = await ContainerDetector.readFileAsync(this.DEFAULT_CGROUP_V1_PATH, this.UTF8_UNICODE);
        const splitData = rawData.trim().split('\n');
        for (const line of splitData) {
            const containerID = extractContainerIdFromLine(line);
            if (containerID) {
                return containerID;
            }
        }
        return undefined;
    }
    async _getContainerIdV2() {
        const rawData = await ContainerDetector.readFileAsync(this.DEFAULT_CGROUP_V2_PATH, this.UTF8_UNICODE);
        const str = rawData
            .trim()
            .split('\n')
            .find(s => s.includes(this.HOSTNAME));
        if (!str)
            return '';
        const strArray = str?.split('/') ?? [];
        for (let i = 0; i < strArray.length - 1; i++) {
            if (this.MARKING_PREFIX.includes(strArray[i]) &&
                strArray[i + 1]?.length === this.CONTAINER_ID_LENGTH) {
                return strArray[i + 1];
            }
        }
        return '';
    }
    /*
      cgroupv1 path would still exist in case of container running on v2
      but the cgroupv1 path would no longer have the container id and would
      fallback on the cgroupv2 implementation.
    */
    async _getContainerId() {
        try {
            const containerIdV1 = await this._getContainerIdV1();
            if (containerIdV1) {
                return containerIdV1; // If containerIdV1 is a non-empty string, return it.
            }
            const containerIdV2 = await this._getContainerIdV2();
            if (containerIdV2) {
                return containerIdV2; // If containerIdV2 is a non-empty string, return it.
            }
        }
        catch (e) {
            if (e instanceof Error) {
                const errorMessage = e.message;
                diag.debug('Container Detector failed to read the Container ID: ', errorMessage);
            }
        }
        return undefined; // Explicitly return undefined if neither ID is found.
    }
}
export { ContainerDetector };
export const containerDetector = new ContainerDetector();
//# sourceMappingURL=ContainerDetector.js.map