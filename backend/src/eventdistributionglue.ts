import * as AWS from 'aws-sdk';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { withErrorHandling } from './Utils';
import HttpStatusCode from '@awscqrs/core/src/common/HttpStatusCodes';

const TOPIC_ARN = process.env.TOPIC_ARN || '';

const sns = new AWS.SNS({ apiVersion: '2021-08-07' });

export const handler = async (event: DynamoDBStreamEvent) => {
  return withErrorHandling(async () => {
    console.log('Starting event: %j ', JSON.stringify(event));

    for (const record of event.Records) {
      if (!record?.dynamodb?.NewImage) {
        continue;
      }

      const message: Record<string, any> = {};
      for (const key in record.dynamodb.NewImage) {
        message[key] =
          record.dynamodb.NewImage[key].S ??
          record.dynamodb.NewImage[key].SS ??
          record.dynamodb.NewImage[key].BOOL ??
          record.dynamodb.NewImage[key].BS ??
          record.dynamodb.NewImage[key].L ??
          record.dynamodb.NewImage[key].M ??
          record.dynamodb.NewImage[key].N ??
          record.dynamodb.NewImage[key].NS ??
          record.dynamodb.NewImage[key].NULL ??
          '';
      }

      console.log('MESSAGE: %j', message);

      // Build dynamo db item
      const params = {
        MessageGroupId: message.owner,
        MessageDeduplicationId: message.RequestId,
        Message: JSON.stringify(message),
        TopicArn: TOPIC_ARN,
      };

      await sns.publish(params).promise();
    }

    return { statusCode: HttpStatusCode.OK, body: '' };
  });
};
