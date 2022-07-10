// https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
exports.handler = (event, context, callback) => {
  const code = event.request.codeParameter;
  const locale = event.request.userAttributes.locale;
  event.response.emailSubject = 'Hello';
  event.response.smsMessage = 'World: ' + code;
  event.response.emailMessage = 'World:' + code;

  callback(null, event);
};
