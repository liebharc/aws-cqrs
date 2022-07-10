import * as AWS from 'aws-sdk';
import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import HttpStatusCode from '@awscqrs/core/src/common/HttpStatusCodes';
import { getHttpMethod, getUserId, withErrorHandling } from './Utils';
import { v4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME || '';

const docClient = new AWS.DynamoDB.DocumentClient();

export const handler = async (
  event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
  return withErrorHandling(async () => {
    if (getHttpMethod(event) != 'POST') {
      return {
        statusCode: HttpStatusCode.METHOD_NOT_ALLOWED,
        body: 'method not allowed',
      };
    }

    if (!event.body) {
      return {
        statusCode: HttpStatusCode.BAD_REQUEST,
        body: 'invalid request',
      };
    }

    const userId = getUserId(event);
    console.log(`userId: ${userId}`);
    const body = JSON.parse(event.body);

    // Build dynamo db item
    const params = {
      TableName: TABLE_NAME,
      Item: {
        owner: userId,
        timestamp: new Date().toISOString(),
        id: v4(),
        ...body,
      },
    };
    console.log('ITEM: %j', params);

    await docClient.put(params).promise();
    return { statusCode: HttpStatusCode.OK, body: '' };
  });
};
