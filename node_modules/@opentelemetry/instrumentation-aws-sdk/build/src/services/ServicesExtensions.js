"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesExtensions = void 0;
const sqs_1 = require("./sqs");
const bedrock_runtime_1 = require("./bedrock-runtime");
const dynamodb_1 = require("./dynamodb");
const secretsmanager_1 = require("./secretsmanager");
const sns_1 = require("./sns");
const stepfunctions_1 = require("./stepfunctions");
const lambda_1 = require("./lambda");
const s3_1 = require("./s3");
const kinesis_1 = require("./kinesis");
class ServicesExtensions {
    services = new Map();
    constructor() {
        this.registerServices();
    }
    registerServices() {
        this.services.set('SecretsManager', new secretsmanager_1.SecretsManagerServiceExtension());
        this.services.set('SFN', new stepfunctions_1.StepFunctionsServiceExtension());
        this.services.set('SQS', new sqs_1.SqsServiceExtension());
        this.services.set('SNS', new sns_1.SnsServiceExtension());
        this.services.set('DynamoDB', new dynamodb_1.DynamodbServiceExtension());
        this.services.set('Lambda', new lambda_1.LambdaServiceExtension());
        this.services.set('S3', new s3_1.S3ServiceExtension());
        this.services.set('Kinesis', new kinesis_1.KinesisServiceExtension());
        this.services.set('BedrockRuntime', new bedrock_runtime_1.BedrockRuntimeServiceExtension());
    }
    requestPreSpanHook(request, config, diag) {
        const serviceExtension = this.services.get(request.serviceName);
        if (!serviceExtension)
            return {
                isIncoming: false,
            };
        return serviceExtension.requestPreSpanHook(request, config, diag);
    }
    requestPostSpanHook(request) {
        const serviceExtension = this.services.get(request.serviceName);
        if (!serviceExtension?.requestPostSpanHook)
            return;
        return serviceExtension.requestPostSpanHook(request);
    }
    responseHook(response, span, tracer, config, startTime) {
        const serviceExtension = this.services.get(response.request.serviceName);
        return serviceExtension?.responseHook?.(response, span, tracer, config, startTime);
    }
    updateMetricInstruments(meter) {
        for (const serviceExtension of this.services.values()) {
            serviceExtension.updateMetricInstruments?.(meter);
        }
    }
}
exports.ServicesExtensions = ServicesExtensions;
//# sourceMappingURL=ServicesExtensions.js.map