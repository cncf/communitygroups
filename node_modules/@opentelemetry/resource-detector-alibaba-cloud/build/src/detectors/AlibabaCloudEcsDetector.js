"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.alibabaCloudEcsDetector = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const semconv_1 = require("../semconv");
const http = require("http");
/**
 * The AlibabaCloudEcsDetector can be used to detect if a process is running in
 * AlibabaCloud ECS and return a {@link Resource} populated with metadata about
 * the ECS instance. Returns an empty Resource if detection fails.
 */
class AlibabaCloudEcsDetector {
    /**
     * See https://www.alibabacloud.com/help/doc-detail/67254.htm for
     * documentation about the AlibabaCloud instance identity document.
     */
    ALIBABA_CLOUD_IDMS_ENDPOINT = '100.100.100.200';
    ALIBABA_CLOUD_INSTANCE_IDENTITY_DOCUMENT_PATH = '/latest/dynamic/instance-identity/document';
    ALIBABA_CLOUD_INSTANCE_HOST_DOCUMENT_PATH = '/latest/meta-data/hostname';
    MILLISECONDS_TIME_OUT = 1000;
    /**
     * Attempts to connect and obtain an AlibabaCloud instance Identity document.
     * If the connection is successful it returns a promise containing a
     * {@link Resource} populated with instance metadata.
     *
     * @param config (unused) The resource detection config
     */
    detect() {
        const dataPromise = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._gatherData());
        const attrNames = [
            semconv_1.ATTR_CLOUD_PROVIDER,
            semconv_1.ATTR_CLOUD_PLATFORM,
            semconv_1.ATTR_CLOUD_ACCOUNT_ID,
            semconv_1.ATTR_CLOUD_REGION,
            semconv_1.ATTR_CLOUD_AVAILABILITY_ZONE,
            semconv_1.ATTR_HOST_ID,
            semconv_1.ATTR_HOST_TYPE,
            semconv_1.ATTR_HOST_NAME,
        ];
        const attributes = {};
        attrNames.forEach(name => {
            // Each resource attribute is determined asynchronously in _gatherData().
            attributes[name] = dataPromise.then(data => data[name]);
        });
        return { attributes };
    }
    /** Gets identity and host info and returns them as attribs. Empty object if fails */
    async _gatherData() {
        try {
            const { 'owner-account-id': accountId, 'instance-id': instanceId, 'instance-type': instanceType, 'region-id': region, 'zone-id': availabilityZone, } = await this._fetchIdentity();
            const hostname = await this._fetchHost();
            return {
                [semconv_1.ATTR_CLOUD_PROVIDER]: semconv_1.CLOUD_PROVIDER_VALUE_ALIBABA_CLOUD,
                [semconv_1.ATTR_CLOUD_PLATFORM]: semconv_1.CLOUD_PLATFORM_VALUE_ALIBABA_CLOUD_ECS,
                [semconv_1.ATTR_CLOUD_ACCOUNT_ID]: accountId,
                [semconv_1.ATTR_CLOUD_REGION]: region,
                [semconv_1.ATTR_CLOUD_AVAILABILITY_ZONE]: availabilityZone,
                [semconv_1.ATTR_HOST_ID]: instanceId,
                [semconv_1.ATTR_HOST_TYPE]: instanceType,
                [semconv_1.ATTR_HOST_NAME]: hostname,
            };
        }
        catch (err) {
            api_1.diag.debug(`${this.constructor.name}: did not detect resource: ${err?.message}`);
            return {};
        }
    }
    /**
     * Fetch AlibabaCloud instance document url with http requests. If the
     * application is running on an ECS instance, we should be able to get back a
     * valid JSON document. Parses that document and stores the identity
     * properties in a local map.
     */
    async _fetchIdentity() {
        const options = {
            host: this.ALIBABA_CLOUD_IDMS_ENDPOINT,
            path: this.ALIBABA_CLOUD_INSTANCE_IDENTITY_DOCUMENT_PATH,
            method: 'GET',
            timeout: this.MILLISECONDS_TIME_OUT,
        };
        const identity = await this._fetchString(options);
        return JSON.parse(identity);
    }
    async _fetchHost() {
        const options = {
            host: this.ALIBABA_CLOUD_IDMS_ENDPOINT,
            path: this.ALIBABA_CLOUD_INSTANCE_HOST_DOCUMENT_PATH,
            method: 'GET',
            timeout: this.MILLISECONDS_TIME_OUT,
        };
        return await this._fetchString(options);
    }
    async _fetchString(options) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                req.destroy(new Error('ECS metadata api request timed out.'));
            }, this.MILLISECONDS_TIME_OUT);
            const req = http.request(options, res => {
                clearTimeout(timeoutId);
                const { statusCode } = res;
                if (typeof statusCode !== 'number' ||
                    !(statusCode >= 200 && statusCode < 300)) {
                    res.destroy();
                    return reject(new Error(`Failed to load page, status code: ${statusCode}`));
                }
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', chunk => (rawData += chunk));
                res.on('error', err => {
                    reject(err);
                });
                res.on('end', () => {
                    resolve(rawData);
                });
            });
            req.on('error', err => {
                clearTimeout(timeoutId);
                reject(err);
            });
            req.end();
        });
    }
}
exports.alibabaCloudEcsDetector = new AlibabaCloudEcsDetector();
//# sourceMappingURL=AlibabaCloudEcsDetector.js.map