import { DynamoDBStreamEvent } from 'aws-lambda';
import { withErrorHandling } from './Utils';
import HttpStatusCode from '@awscqrs/core/src/common/HttpStatusCodes';
import AWSAppSyncClient, { AUTH_TYPE } from 'aws-appsync';
import { gql } from 'graphql-tag';
require('cross-fetch/polyfill');

const APP_SYNC_API_URL = process.env.APP_SYNC_API_URL || '';
const MUTATION = process.env.MUTATION || '';

const graphqlClient = new AWSAppSyncClient({
  url: APP_SYNC_API_URL,
  region: process.env.AWS_REGION ?? '',
  auth: {
    type: AUTH_TYPE.AWS_IAM,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
  },
  disableOffline: true,
});

const mutation = gql(MUTATION);

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
      await graphqlClient.mutate({
        mutation,
        variables: message,
      });
    }

    return { statusCode: HttpStatusCode.OK, body: '' };
  });
};
