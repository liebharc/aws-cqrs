import * as AWS from 'aws-sdk';
import { SQSEvent } from 'aws-lambda';
import HttpStatusCode from '@awscqrs/core/src/common/HttpStatusCodes';
import { withErrorHandling } from './Utils';

const docClient = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: SQSEvent) => {
  return withErrorHandling(async () => {
    console.log('Starting event: %j ', JSON.stringify(event));
    for (const record of event.Records) {
      const body = JSON.parse(record.body);
      const message = JSON.parse(body.Message);
      const note = {
        id: message.id,
        name: message.name,
        completed: message.completed,
      };
      console.log('Message: %j ', JSON.stringify(note));
      // Build dynamodb item
      const params = {
        TableName: TABLE_NAME,
        Item: note,
      };
      console.log('ITEM: %j', params);

      // Insert dynamodb item
      await docClient.put(params).promise();
    }

    return { statusCode: HttpStatusCode.OK, body: '' };
  });
};
