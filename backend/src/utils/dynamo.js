/**
 * dynamo.js — DynamoDB helper utilities.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  USERS:       process.env.USERS_TABLE       || 'EduCloud-Users',
  ASSIGNMENTS: process.env.ASSIGNMENTS_TABLE || 'EduCloud-Assignments',
  SUBMISSIONS: process.env.SUBMISSIONS_TABLE || 'EduCloud-Submissions',
};

// ─── Generic helpers ──────────────────────────────────────────────────────

async function getItem(tableName, key) {
  const res = await docClient.send(new GetCommand({ TableName: tableName, Key: key }));
  return res.Item || null;
}

async function putItem(tableName, item) {
  await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function updateItem(tableName, key, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return null;
  const ExpressionAttributeNames  = {};
  const ExpressionAttributeValues = {};
  const parts = keys.map(k => {
    ExpressionAttributeNames[`#${k}`]  = k;
    ExpressionAttributeValues[`:${k}`] = updates[k];
    return `#${k} = :${k}`;
  });
  const UpdateExpression = `SET ${parts.join(', ')}`;
  const res = await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

async function queryItems(tableName, indexName, keyCondition, expressionValues, filterExpression = null) {
  const params = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
  };
  if (filterExpression) params.FilterExpression = filterExpression;
  const res = await docClient.send(new QueryCommand(params));
  return res.Items || [];
}

async function scanItems(tableName, filterExpression = null, expressionValues = null) {
  const params = { TableName: tableName };
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionValues;
  }
  const res = await docClient.send(new ScanCommand(params));
  return res.Items || [];
}

module.exports = { TABLES, getItem, putItem, updateItem, deleteItem, queryItems, scanItems };
