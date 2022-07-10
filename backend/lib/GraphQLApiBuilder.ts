import * as appsyncalpha from '@aws-cdk/aws-appsync-alpha';
import { CfnOutput } from 'aws-cdk-lib';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { BasicInfrastructure } from './BasicInfrastructure';

export interface GraphQLApiBuilderProps {
  name: string;
  schema: string;
  endpointName: string;
}

export type GraphQlTypes = 'Query' | 'Mutation';
export class GraphQLApiBuilder {
  private readonly basicInfrastructure: BasicInfrastructure;

  private readonly graphqlApi: appsyncalpha.GraphqlApi;
  private noneDataSource: appsyncalpha.NoneDataSource | null = null;

  constructor(
    basicInfrastructure: BasicInfrastructure,
    props: GraphQLApiBuilderProps,
  ) {
    this.basicInfrastructure = basicInfrastructure;
    this.graphqlApi = this.createGraphQlApi(props.name, props.schema);
    new CfnOutput(this.basicInfrastructure.scope, props.endpointName, {
      value: this.graphqlApi.graphqlUrl,
    });
  }

  private createGraphQlApi(
    name: string,
    schema: string,
  ): appsyncalpha.GraphqlApi {
    return new appsyncalpha.GraphqlApi(this.basicInfrastructure.scope, name, {
      name: name,
      schema: appsyncalpha.Schema.fromAsset(schema),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsyncalpha.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: this.basicInfrastructure.userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsyncalpha.AuthorizationType.IAM,
          },
        ],
      },
    });
  }

  public url() {
    return this.graphqlApi.graphqlUrl;
  }

  public api() {
    return this.graphqlApi;
  }

  public getNoneDataSource(): appsyncalpha.NoneDataSource {
    if (this.noneDataSource === null) {
      this.noneDataSource = this.graphqlApi.addNoneDataSource(
        this.graphqlApi.node.id + '-None-DataSource',
      );
    }

    return this.noneDataSource;
  }

  public addLambdaDataSource(
    lambda: lambdaNodejs.NodejsFunction,
    addResolver: (dataSource: GraphLambdaDataSourceBuilder) => void,
  ): GraphQLApiBuilder {
    const dataSource = this.graphqlApi.addLambdaDataSource(
      this.graphqlApi.node.id + '-' + lambda.node.id + '-DataSource',
      lambda,
    );
    addResolver(new GraphLambdaDataSourceBuilder(this, dataSource));
    return this;
  }

  public addTableDataSource(
    table: dynamodb.ITable,
    addResolver: (dataSource: GraphTableDataSourceBuilder) => void,
  ): GraphQLApiBuilder {
    const dataSource = this.graphqlApi.addDynamoDbDataSource(
      this.graphqlApi.node.id + '-' + table.node.id + '-DataSource',
      table,
    );
    addResolver(new GraphTableDataSourceBuilder(this, dataSource));
    return this;
  }
}

abstract class GraphNoneDataSourceBuilder {
  private graphApi: GraphQLApiBuilder;

  constructor(graphApi: GraphQLApiBuilder) {
    this.graphApi = graphApi;
  }

  public addNoneResolver(
    typeName: GraphQlTypes,
    fieldName: string,
  ): GraphNoneDataSourceBuilder {
    this.graphApi.getNoneDataSource().createResolver({
      typeName,
      fieldName,
      // Source: https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-none.html
      requestMappingTemplate: appsyncalpha.MappingTemplate.fromString(`{
        "version": "2018-05-29",
        "payload": $util.toJson($context.arguments)
    }`),
      responseMappingTemplate: appsyncalpha.MappingTemplate.fromString(
        '$util.toJson($context.result)',
      ),
    });
    return this;
  }
}

export class GraphLambdaDataSourceBuilder extends GraphNoneDataSourceBuilder {
  private readonly dataSource: appsyncalpha.LambdaDataSource;

  constructor(
    graphApi: GraphQLApiBuilder,
    dataSource: appsyncalpha.LambdaDataSource,
  ) {
    super(graphApi);
    this.dataSource = dataSource;
  }

  public addResolver(
    typeName: GraphQlTypes,
    fieldName: string,
  ): GraphLambdaDataSourceBuilder {
    this.dataSource.createResolver({ typeName, fieldName });
    return this;
  }
}

export class GraphTableDataSourceBuilder extends GraphNoneDataSourceBuilder {
  private readonly dataSource: appsyncalpha.DynamoDbDataSource;

  constructor(
    graphApi: GraphQLApiBuilder,
    dataSource: appsyncalpha.DynamoDbDataSource,
  ) {
    super(graphApi);
    this.dataSource = dataSource;
  }

  public addResolver(
    typeName: GraphQlTypes,
    fieldName: string,
    requestMappingTemplate: appsyncalpha.MappingTemplate,
    responseMappingTemplate: appsyncalpha.MappingTemplate,
  ): GraphTableDataSourceBuilder {
    this.dataSource.createResolver({
      typeName,
      fieldName,
      requestMappingTemplate,
      responseMappingTemplate,
    });
    return this;
  }
}
