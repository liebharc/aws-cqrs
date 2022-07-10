import HttpStatusCode from '@awscqrs/core/src/common/HttpStatusCodes';
import {
  CustomError,
  IncorrectRequestError,
} from '@awscqrs/core/src/common/ValidationErrors';
import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';

export async function withErrorHandling(
  handler: () => Promise<APIGatewayProxyResult>,
): Promise<APIGatewayProxyResult> {
  try {
    return await handler();
  } catch (error: any) {
    console.error(JSON.stringify(error));
    if (error instanceof CustomError) {
      return {
        statusCode: error.code,
        body: JSON.stringify(error.message),
      };
    }

    return {
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      body: JSON.stringify(error.message),
    };
  }
}

export function getUserId(event: APIGatewayEvent): string {
  const userId = getClaim(event, 'cognito:username');
  console.log('current user=' + userId);
  if (!userId) {
    throw new IncorrectRequestError('User is not authenticated');
  }
  return userId;
}

export function getHttpMethod(event: APIGatewayEvent): string {
  const httpMethod = event?.httpMethod
    ? event.httpMethod
    : event?.requestContext?.http?.method;
  if (!httpMethod) {
    throw new IncorrectRequestError('HTTP method is not specified');
  }

  return httpMethod;
}

export function isIncludedInGroup(
  group: UserGroups,
  event: APIGatewayEvent,
): boolean {
  const groupsString = getClaim(event, 'cognito:groups');
  return isIncludedInGroupValue(group, groupsString);
}

export type UserGroups = 'admins';

export function isIncludedInGroupValue(
  group: UserGroups,
  groupsString: string,
): boolean {
  try {
    if (groupsString) {
      if (groupsString.startsWith('[')) {
        groupsString = groupsString.substring(1, groupsString.length - 1);
      }
      const groups = groupsString.split(',').map((g) => g.trim());
      return groups.find((g) => g === group) !== undefined;
    } else {
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}

function getClaim(event: APIGatewayEvent, claim: string) {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims) {
    return null;
  }

  if (!claims[claim]) {
    return null;
  }

  return claims[claim];
}
