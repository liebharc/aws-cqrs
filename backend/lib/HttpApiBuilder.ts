import * as apigatewayv2Alpha from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2IntegrationsAlpha from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { BasicInfrastructure } from './BasicInfrastructure';

export interface HttpApiBuilderProps {
  name: string;
  endpointName: string;
}

export class HttpApiBuilder {
  private readonly basicInfrastructure: BasicInfrastructure;

  private readonly httpApi: apigatewayv2Alpha.HttpApi;

  constructor(
    basicInfrastructure: BasicInfrastructure,
    props: HttpApiBuilderProps,
  ) {
    this.basicInfrastructure = basicInfrastructure;
    this.httpApi = this.createHttpApi(basicInfrastructure.scope, props.name);
    new CfnOutput(this.basicInfrastructure.scope, props.endpointName, {
      value: this.httpApi.url ?? '',
    });
  }

  private createHttpApi(scope: Stack, name: string): apigatewayv2Alpha.HttpApi {
    return new apigatewayv2Alpha.HttpApi(scope, name, {
      description: name,
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: [
          apigatewayv2Alpha.CorsHttpMethod.OPTIONS,
          apigatewayv2Alpha.CorsHttpMethod.GET,
          apigatewayv2Alpha.CorsHttpMethod.POST,
          apigatewayv2Alpha.CorsHttpMethod.PUT,
          apigatewayv2Alpha.CorsHttpMethod.PATCH,
          apigatewayv2Alpha.CorsHttpMethod.DELETE,
        ],
        allowOrigins: ['*'],
      },
    });
  }

  public addAuthorizedRoute(
    path: string,
    lambda: lambdaNodejs.NodejsFunction,
    httpMethods?: apigatewayv2Alpha.HttpMethod[],
  ): HttpApiBuilder {
    if (httpMethods === undefined) {
      httpMethods = [apigatewayv2Alpha.HttpMethod.ANY];
    }

    this.httpApi.addRoutes({
      path: path,
      methods: httpMethods,
      integration: new apigatewayv2IntegrationsAlpha.HttpLambdaIntegration(
        'protected-fn-integration',
        lambda,
      ),
      authorizer: this.basicInfrastructure.authorizer,
    });
    return this;
  }

  public addUnAuthorizedRoute(
    path: string,
    lambda: lambdaNodejs.NodejsFunction,
    httpMethods?: apigatewayv2Alpha.HttpMethod[],
  ): HttpApiBuilder {
    if (httpMethods === undefined) {
      httpMethods = [apigatewayv2Alpha.HttpMethod.ANY];
    }

    this.httpApi.addRoutes({
      path: path,
      methods: httpMethods,
      integration: new apigatewayv2IntegrationsAlpha.HttpLambdaIntegration(
        'protected-fn-integration',
        lambda,
      ),
    });
    return this;
  }
}
