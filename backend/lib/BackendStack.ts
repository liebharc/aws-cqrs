import { CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { EnvProps } from './AbstractInfrastructure';
import { BasicInfrastructure } from './BasicInfrastructure';
import { ServiceInfrastructure } from './ServiceInfrastructure';

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: EnvProps) {
    super(scope, id, props);
    const basicInfrastructure = new BasicInfrastructure(this, props);
    new ServiceInfrastructure(basicInfrastructure, props);
    new CfnOutput(this, 'region', {
      value: props.env?.region ?? 'eu-central-1',
    });

    /*
		// Set up a bucket
		const bucket = new s3.Bucket(this, 'content-items', {
			accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
		});

		// Delegating access control to access points
		// https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-policies.html
		bucket.addToResourcePolicy(
			new iam.PolicyStatement({
				actions: ['*'],
				principals: [new iam.AnyPrincipal()],
				resources: [bucket.bucketArn, bucket.arnForObjects('*')],
				conditions: {
					StringEquals: {
						's3:DataAccessPointAccount': `${props?.env?.account}`,
					},
				},
			})
		);
		new CfnOutput(this, 'content-items-bucket', {
			value: bucket.bucketWebsiteUrl,
		});*/
  }
}

export function addCorsOptions(apiResource: apiGateway.IResource) {
  apiResource.addMethod(
    'OPTIONS',
    new apiGateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers':
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials':
              "'false'",
            'method.response.header.Access-Control-Allow-Methods':
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    },
  );
}
