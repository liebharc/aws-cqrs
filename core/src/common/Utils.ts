import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';

export function generateRandomId(): string {
  return uuidv4();
}

export function getCurrentDate(): string {
  return DateTime.utc().toFormat('yyyy-MM-dd');
}

export function nowUtc(): DateTime {
  return DateTime.utc();
}

export function formatUtc(dateTime: DateTime): string {
  return dateTime.toUTC().toISO();
}

export function parseDate(date: string): DateTime {
  return DateTime.fromFormat(date, 'yyyy-MM-dd', {
    zone: 'UTC',
  });
}

export function parseIntOrThrow(value: string): number {
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    throw new Error('Invalid number: ' + value);
  }
  return parsed;
}

export interface ApiEvent {
  body: string | null;
  requestContext: {
    authorizer?: {
      [name: string]: any;
    } | null;
    http?: {
      method?: string;
    };
  };
  queryStringParameters: {
    [key: string]: string | undefined;
  } | null;
  httpMethod?: string;
}

export interface ApiResponse {
  statusCode: number;
  body: string;
}
