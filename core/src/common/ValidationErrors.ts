import HttpStatusCode from './HttpStatusCodes';

export class CustomError extends Error {
  constructor(message: string, public code: number) {
    super(message);
    this.code = code;
  }
}

export class IncorrectRequestError extends CustomError {
  constructor(message: string) {
    super(message, HttpStatusCode.BAD_REQUEST);
  }
}
export class NotAllowedError extends CustomError {
  constructor(message: string) {
    super(message, HttpStatusCode.METHOD_NOT_ALLOWED);
  }
}
export class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, HttpStatusCode.NOT_FOUND);
  }
}

export class UserIsOnANewerVersion extends CustomError {
  constructor() {
    super(
      'User is on a newer API version',
      HttpStatusCode.INTERNAL_SERVER_ERROR,
    );
  }
}
