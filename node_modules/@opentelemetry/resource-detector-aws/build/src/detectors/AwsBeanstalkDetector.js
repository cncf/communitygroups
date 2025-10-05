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
exports.awsBeanstalkDetector = exports.AwsBeanstalkDetector = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const semconv_1 = require("../semconv");
const fs = require("fs");
const util = require("util");
/**
 * The AwsBeanstalkDetector can be used to detect if a process is running in AWS Elastic
 * Beanstalk and return a {@link Resource} populated with data about the beanstalk
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 *
 * See https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-guide.pdf
 * for more details about detecting information of Elastic Beanstalk plugins
 */
const DEFAULT_BEANSTALK_CONF_PATH = '/var/elasticbeanstalk/xray/environment.conf';
const WIN_OS_BEANSTALK_CONF_PATH = 'C:\\Program Files\\Amazon\\XRay\\environment.conf';
class AwsBeanstalkDetector {
    BEANSTALK_CONF_PATH;
    static readFileAsync = util.promisify(fs.readFile);
    static fileAccessAsync = util.promisify(fs.access);
    constructor() {
        if (process.platform === 'win32') {
            this.BEANSTALK_CONF_PATH = WIN_OS_BEANSTALK_CONF_PATH;
        }
        else {
            this.BEANSTALK_CONF_PATH = DEFAULT_BEANSTALK_CONF_PATH;
        }
    }
    detect() {
        const dataPromise = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._gatherData());
        const attrNames = [
            semconv_1.ATTR_CLOUD_PROVIDER,
            semconv_1.ATTR_CLOUD_PLATFORM,
            semantic_conventions_1.ATTR_SERVICE_NAME,
            semconv_1.ATTR_SERVICE_NAMESPACE,
            semantic_conventions_1.ATTR_SERVICE_VERSION,
            semconv_1.ATTR_SERVICE_INSTANCE_ID,
        ];
        const attributes = {};
        attrNames.forEach(name => {
            // Each resource attribute is determined asynchronously in _gatherData().
            attributes[name] = dataPromise.then(data => data[name]);
        });
        return { attributes };
    }
    /**
     * Async resource attributes for AWS Beanstalk configuration read from file.
     */
    async _gatherData() {
        try {
            await AwsBeanstalkDetector.fileAccessAsync(this.BEANSTALK_CONF_PATH, fs.constants.R_OK);
            const rawData = await AwsBeanstalkDetector.readFileAsync(this.BEANSTALK_CONF_PATH, 'utf8');
            const parsedData = JSON.parse(rawData);
            return {
                [semconv_1.ATTR_CLOUD_PROVIDER]: semconv_1.CLOUD_PROVIDER_VALUE_AWS,
                [semconv_1.ATTR_CLOUD_PLATFORM]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK,
                [semantic_conventions_1.ATTR_SERVICE_NAME]: semconv_1.CLOUD_PLATFORM_VALUE_AWS_ELASTIC_BEANSTALK,
                [semconv_1.ATTR_SERVICE_NAMESPACE]: parsedData.environment_name,
                [semantic_conventions_1.ATTR_SERVICE_VERSION]: parsedData.version_label,
                [semconv_1.ATTR_SERVICE_INSTANCE_ID]: parsedData.deployment_id,
            };
        }
        catch (e) {
            api_1.diag.debug(`AwsBeanstalkDetector: did not detect resource: ${e.message}`);
            return {};
        }
    }
}
exports.AwsBeanstalkDetector = AwsBeanstalkDetector;
exports.awsBeanstalkDetector = new AwsBeanstalkDetector();
//# sourceMappingURL=AwsBeanstalkDetector.js.map