import * as apigateway from 'aws-cdk-lib/aws-apigateway';

import { CfnOutput, Stack } from 'aws-cdk-lib';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { BasicInfrastructure } from './BasicInfrastructure';

export interface RestApiBuilderProps {
  name: string;
  endpointName: string;
}

export type RestMethod =
  | 'ANY'
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT';

export class RestApiBuilder {
  private readonly basicInfrastructure: BasicInfrastructure;

  private readonly restApi: apigateway.RestApi;

  constructor(
    basicInfrastructure: BasicInfrastructure,
    props: RestApiBuilderProps,
  ) {
    this.basicInfrastructure = basicInfrastructure;
    this.restApi = this.createRestApi(basicInfrastructure.scope, props.name);
    new CfnOutput(this.basicInfrastructure.scope, props.endpointName, {
      value: this.restApi.url,
    });
  }

  private createRestApi(scope: Stack, name: string): apigateway.RestApi {
    return new apigateway.RestApi(scope, name, {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
    });
  }

  public addAuthorizedRoute(
    path: string,
    lambda: lambdaNodejs.NodejsFunction,
    httpMethods?: RestMethod[],
  ): RestApiBuilder {
    if (httpMethods === undefined) {
      httpMethods = ['ANY'];
    }

    const resource = this.restApi.root.addResource(path);
    httpMethods.forEach((httpMethod) => {
      resource.addMethod(
        httpMethod,
        new apigateway.LambdaIntegration(lambda, {}),
        {
          authorizer: this.basicInfrastructure.cognitoAuthorizer,
        },
      );
    });
    return this;
  }

  public addUnAuthorizedRoute(
    path: string,
    lambda: lambdaNodejs.NodejsFunction,
    httpMethods?: RestMethod[],
  ): RestApiBuilder {
    if (httpMethods === undefined) {
      httpMethods = ['ANY'];
    }

    const resource = this.restApi.root.addResource(path);
    httpMethods.forEach((httpMethod) => {
      resource.addMethod(
        httpMethod,
        new apigateway.LambdaIntegration(lambda, {}),
        {},
      );
    });
    return this;
  }
}
