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
exports.awsLambdaDetector = exports.awsEksDetector = exports.awsEcsDetector = exports.awsEc2Detector = exports.awsBeanstalkDetector = void 0;
var AwsBeanstalkDetector_1 = require("./AwsBeanstalkDetector");
Object.defineProperty(exports, "awsBeanstalkDetector", { enumerable: true, get: function () { return AwsBeanstalkDetector_1.awsBeanstalkDetector; } });
var AwsEc2Detector_1 = require("./AwsEc2Detector");
Object.defineProperty(exports, "awsEc2Detector", { enumerable: true, get: function () { return AwsEc2Detector_1.awsEc2Detector; } });
var AwsEcsDetector_1 = require("./AwsEcsDetector");
Object.defineProperty(exports, "awsEcsDetector", { enumerable: true, get: function () { return AwsEcsDetector_1.awsEcsDetector; } });
var AwsEksDetector_1 = require("./AwsEksDetector");
Object.defineProperty(exports, "awsEksDetector", { enumerable: true, get: function () { return AwsEksDetector_1.awsEksDetector; } });
var AwsLambdaDetector_1 = require("./AwsLambdaDetector");
Object.defineProperty(exports, "awsLambdaDetector", { enumerable: true, get: function () { return AwsLambdaDetector_1.awsLambdaDetector; } });
//# sourceMappingURL=index.js.map