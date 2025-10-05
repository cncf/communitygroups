"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamodbServiceExtension = void 0;
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
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
class DynamodbServiceExtension {
    toArray(values) {
        return Array.isArray(values) ? values : [values];
    }
    requestPreSpanHook(normalizedRequest, config, diag) {
        const spanKind = api_1.SpanKind.CLIENT;
        let spanName;
        const isIncoming = false;
        const operation = normalizedRequest.commandName;
        const spanAttributes = {
            [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_DYNAMODB,
            [semantic_conventions_1.SEMATTRS_DB_NAME]: normalizedRequest.commandInput?.TableName,
            [semantic_conventions_1.SEMATTRS_DB_OPERATION]: operation,
        };
        if (config.dynamoDBStatementSerializer) {
            try {
                const sanitizedStatement = config.dynamoDBStatementSerializer(operation, normalizedRequest.commandInput);
                if (typeof sanitizedStatement === 'string') {
                    spanAttributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = sanitizedStatement;
                }
            }
            catch (err) {
                diag.error('failed to sanitize DynamoDB statement', err);
            }
        }
        // normalizedRequest.commandInput.RequestItems) is undefined when no table names are returned
        // keys in this object are the table names
        if (normalizedRequest.commandInput?.TableName) {
            // Necessary for commands with only 1 table name (example: CreateTable). Attribute is TableName not keys of RequestItems
            // single table name returned for operations like CreateTable
            spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TABLE_NAMES] = [
                normalizedRequest.commandInput.TableName,
            ];
        }
        else if (normalizedRequest.commandInput?.RequestItems) {
            spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TABLE_NAMES] = Object.keys(normalizedRequest.commandInput.RequestItems);
        }
        if (operation === 'CreateTable' || operation === 'UpdateTable') {
            // only check for ProvisionedThroughput since ReadCapacityUnits and WriteCapacity units are required attributes
            if (normalizedRequest.commandInput?.ProvisionedThroughput) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_PROVISIONED_READ_CAPACITY] =
                    normalizedRequest.commandInput.ProvisionedThroughput.ReadCapacityUnits;
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_PROVISIONED_WRITE_CAPACITY] =
                    normalizedRequest.commandInput.ProvisionedThroughput.WriteCapacityUnits;
            }
        }
        if (operation === 'GetItem' ||
            operation === 'Scan' ||
            operation === 'Query') {
            if (normalizedRequest.commandInput?.ConsistentRead) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_CONSISTENT_READ] =
                    normalizedRequest.commandInput.ConsistentRead;
            }
        }
        if (operation === 'Query' || operation === 'Scan') {
            if (normalizedRequest.commandInput?.ProjectionExpression) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_PROJECTION] =
                    normalizedRequest.commandInput.ProjectionExpression;
            }
        }
        if (operation === 'CreateTable') {
            if (normalizedRequest.commandInput?.GlobalSecondaryIndexes) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_GLOBAL_SECONDARY_INDEXES] =
                    this.toArray(normalizedRequest.commandInput.GlobalSecondaryIndexes).map((x) => JSON.stringify(x));
            }
            if (normalizedRequest.commandInput?.LocalSecondaryIndexes) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_LOCAL_SECONDARY_INDEXES] =
                    this.toArray(normalizedRequest.commandInput.LocalSecondaryIndexes).map((x) => JSON.stringify(x));
            }
        }
        if (operation === 'ListTables' ||
            operation === 'Query' ||
            operation === 'Scan') {
            if (normalizedRequest.commandInput?.Limit) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_LIMIT] =
                    normalizedRequest.commandInput.Limit;
            }
        }
        if (operation === 'ListTables') {
            if (normalizedRequest.commandInput?.ExclusiveStartTableName) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_EXCLUSIVE_START_TABLE] =
                    normalizedRequest.commandInput.ExclusiveStartTableName;
            }
        }
        if (operation === 'Query') {
            if (normalizedRequest.commandInput?.ScanIndexForward) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SCAN_FORWARD] =
                    normalizedRequest.commandInput.ScanIndexForward;
            }
            if (normalizedRequest.commandInput?.IndexName) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_INDEX_NAME] =
                    normalizedRequest.commandInput.IndexName;
            }
            if (normalizedRequest.commandInput?.Select) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SELECT] =
                    normalizedRequest.commandInput.Select;
            }
        }
        if (operation === 'Scan') {
            if (normalizedRequest.commandInput?.Segment) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SEGMENT] =
                    normalizedRequest.commandInput?.Segment;
            }
            if (normalizedRequest.commandInput?.TotalSegments) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TOTAL_SEGMENTS] =
                    normalizedRequest.commandInput?.TotalSegments;
            }
            if (normalizedRequest.commandInput?.IndexName) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_INDEX_NAME] =
                    normalizedRequest.commandInput.IndexName;
            }
            if (normalizedRequest.commandInput?.Select) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SELECT] =
                    normalizedRequest.commandInput.Select;
            }
        }
        if (operation === 'UpdateTable') {
            if (normalizedRequest.commandInput?.AttributeDefinitions) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_ATTRIBUTE_DEFINITIONS] =
                    this.toArray(normalizedRequest.commandInput.AttributeDefinitions).map((x) => JSON.stringify(x));
            }
            if (normalizedRequest.commandInput?.GlobalSecondaryIndexUpdates) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_GLOBAL_SECONDARY_INDEX_UPDATES] =
                    this.toArray(normalizedRequest.commandInput.GlobalSecondaryIndexUpdates).map((x) => JSON.stringify(x));
            }
        }
        return {
            isIncoming,
            spanAttributes,
            spanKind,
            spanName,
        };
    }
    responseHook(response, span, _tracer, _config) {
        if (response.data?.ConsumedCapacity) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_CONSUMED_CAPACITY, toArray(response.data.ConsumedCapacity).map((x) => JSON.stringify(x)));
        }
        if (response.data?.ItemCollectionMetrics) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_ITEM_COLLECTION_METRICS, this.toArray(response.data.ItemCollectionMetrics).map((x) => JSON.stringify(x)));
        }
        if (response.data?.TableNames) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TABLE_COUNT, response.data?.TableNames.length);
        }
        if (response.data?.Count) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_COUNT, response.data?.Count);
        }
        if (response.data?.ScannedCount) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SCANNED_COUNT, response.data?.ScannedCount);
        }
    }
}
exports.DynamodbServiceExtension = DynamodbServiceExtension;
function toArray(values) {
    return Array.isArray(values) ? values : [values];
}
//# sourceMappingURL=dynamodb.js.map