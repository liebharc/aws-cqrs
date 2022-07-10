import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Backend from '../lib/BackendStack';

test('Components are created Created', () => {
  const app = new cdk.App();
  const stack = new Backend.BackendStack(app, 'MyTestStack', {
    stackName: 'awscqrs-Test',
    env: {
      account: '123456',
      region: 'eu-central-1',
    },
    type: 'prod',
    terminationProtection: true,
  });
  const template = Template.fromStack(stack);
  /*template.hasResourceProperties('AWS::S3::Bucket', {
		AccessControl: 'BucketOwnerFullControl',
	});*/
  template.hasResourceProperties('AWS::Cognito::UserPool', {
    AliasAttributes: ['preferred_username'],
    AutoVerifiedAttributes: ['email', 'phone_number'],
  });
});
