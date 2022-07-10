import { CfnOutput, Stack } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apiGatewayAuthorizers from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { AbstractInfrastructure, EnvProps } from './AbstractInfrastructure';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { LambdaBuilder } from './LambdaBuilder';
import { RestApiBuilder } from './RestApiBuilder';
import { UserPoolUser } from './UserPoolUser';
import { GraphQLApiBuilder } from './GraphQLApiBuilder';
import { TableBuilder } from './TableBuilder';

export class BasicInfrastructure extends AbstractInfrastructure {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly authorizer: apigatewayv2.IHttpRouteAuthorizer;
  public readonly authenticatedRole: iam.Role;
  public readonly unAuthenticatedRole: iam.Role;
  public readonly cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;
  public readonly api: RestApiBuilder;
  public readonly graph: GraphQLApiBuilder;
  public readonly eventBus: sns.Topic;

  constructor(scope: Stack, props: EnvProps) {
    super(scope, props);
    this.userPool = this.createUserPool(
      this.createMessageTrigger(),
      this.createPreSignUpTrigger(),
    );
    this.userPoolClient = this.addUserPoolClient(this.userPool);
    this.authorizer = this.createAuthorizer(this.userPool, this.userPoolClient);
    this.cognitoAuthorizer = this.createCognitoAuthorizer(this.userPool);
    const identityPoolWrapper = this.initializeIdentityPoolWrapper(
      this.userPool,
      this.userPoolClient,
    );
    this.authenticatedRole = identityPoolWrapper.authenticatedRole;
    this.unAuthenticatedRole = identityPoolWrapper.unAuthenticatedRole;
    this.createAdminsGroup(identityPoolWrapper);
    this.api = new RestApiBuilder(this, {
      name: `PublicRestApi-${this.suffix}`,
      endpointName: 'apiEndpoint',
    });
    this.graph = new GraphQLApiBuilder(this, {
      name: `PublicGraphApi-${this.suffix}`,
      endpointName: 'graphEndpoint',
      schema: 'graphql/schema.graphql',
    });
    this.eventBus = this.createEventBus(this.api);
  }

  /*
    https://blog.ippon.tech/build-an-event-sourcing-system-on-aws-using-dynamodb-and-cdk/
    https://github.com/Falydoor/event-sourcing-dynamodb
  */
  private createEventBus(api: RestApiBuilder) {
    const topic = new sns.Topic(this.scope, `EventTopic-${this.suffix}`, {
      topicName: `EventTopic-${this.suffix}`,
      fifo: true,
    });

    const eventTable = new TableBuilder(this, {
      tableId: `EventTable-${this.suffix}`,
      uniqueId: 'id',
      streaming: true,
    })
      .addLocalSecondaryIndex('Timestamp', { name: 'timestamp', type: 'N' })
      .addLocalSecondaryIndex('Typename', { name: 'typename', type: 'S' })
      .build();

    new LambdaBuilder(this.scope, {
      lambdaId: `EventDistributionGlue-${this.suffix}`,
      entryPoint: 'eventdistributionglue.ts',
      environment: {
        TOPIC_ARN: topic.topicArn,
      },
    })
      .grantPublishToTopic(topic)
      .addTableAsEventSource(eventTable)
      .grantReadFromTable(eventTable)
      .build();

    const commandsservice = new LambdaBuilder(this.scope, {
      lambdaId: `CommandService-${this.suffix}`,
      entryPoint: 'commandservice.ts',
      environment: {
        TABLE_NAME: eventTable.tableName,
      },
    })
      .grantWriteToTable(eventTable)
      .build();

    api.addAuthorizedRoute('command', commandsservice, ['POST']);
    return topic;
  }

  private createMessageTrigger() {
    const builder = new LambdaBuilder(this.scope, {
      lambdaId: `UserPool-CustomMessages-${this.suffix}`,
      entryPoint: 'authmessages.js',
    });
    return builder.build();
  }

  private createPreSignUpTrigger() {
    const builder = new LambdaBuilder(this.scope, {
      lambdaId: `UserPool-CustomVerification-${this.suffix}`,
      entryPoint: 'authverification.ts',
    });
    return builder.build();
  }

  private createUserPool(
    customMessage: lambdaNodejs.NodejsFunction,
    preSignUp: lambdaNodejs.NodejsFunction,
  ): cognito.UserPool {
    const userPool = new cognito.UserPool(
      this.scope,
      `UserPool-${this.suffix}`,
      {
        userPoolName: `UserPool-${this.suffix}`,
        selfSignUpEnabled: true,
        signInAliases: {
          username: true,
          preferredUsername: true,
          email: false,
          phone: false,
        },
        autoVerify: {
          email: true,
          phone: true,
        },
        standardAttributes: {
          preferredUsername: {
            required: false,
            mutable: true,
          },
          phoneNumber: {
            required: false,
            mutable: true,
          },
          email: {
            required: false,
            mutable: true,
          },
          locale: {
            required: false,
            mutable: true,
          },
          timezone: {
            required: false,
            mutable: true,
          },
        },
        customAttributes: {
          invite: new cognito.StringAttribute({ mutable: false }),
        },
        userVerification: { emailStyle: cognito.VerificationEmailStyle.CODE },
        passwordPolicy: {
          minLength: 8,
          requireLowercase: false,
          requireDigits: true,
          requireUppercase: false,
          requireSymbols: false,
        },
        lambdaTriggers: {
          customMessage,
          preSignUp,
        },
        accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
        signInCaseSensitive: false,
        removalPolicy: this.defaultRemovalPolicy,
      },
    );
    if (this.envType == 'prod') {
      userPool.addDomain(`UserPoolDomain-${this.suffix}`, {
        cognitoDomain: {
          domainPrefix: 'awscqrsauth',
        },
      });
    } else {
      new UserPoolUser(this.scope, `TestUser-${this.suffix}`, {
        userPool: userPool,
        username: 'test',
        password: 'test1234',
      });
    }
    new CfnOutput(this.scope, 'userPoolId', {
      value: userPool.userPoolId,
    });

    return userPool;
  }

  private addUserPoolClient(
    userPool: cognito.UserPool,
  ): cognito.UserPoolClient {
    const clientName = `UserPool-Client-${this.suffix}`;
    const userPoolClient = userPool.addClient(clientName, {
      userPoolClientName: clientName,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userPassword: true,
        userSrp: true,
      },
    });
    new CfnOutput(this.scope, 'userPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    return userPoolClient;
  }

  private createAuthorizer(
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ): apigatewayv2.IHttpRouteAuthorizer {
    return new apiGatewayAuthorizers.HttpUserPoolAuthorizer(
      `User-Pool-Authorizer-${this.suffix}`,
      userPool,
      {
        userPoolClients: [userPoolClient],
        identitySource: ['$request.header.Authorization'],
      },
    );
  }

  private createCognitoAuthorizer(
    userPool: cognito.UserPool,
  ): apigateway.CognitoUserPoolsAuthorizer {
    return new apigateway.CognitoUserPoolsAuthorizer(
      this.scope,
      `Cognito-User-Pool-Authorizer-${this.suffix}`,
      {
        authorizerName: `CognitoAuthorizer-${this.suffix}`,
        cognitoUserPools: [userPool],
      },
    );
  }

  private initializeIdentityPoolWrapper(
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ) {
    return new IdentityPoolWrapper(
      this.scope,
      this.props,
      `Identity-Pool-${this.suffix}`,
      userPool,
      userPoolClient,
    );
  }

  private createAdminsGroup(identityPoolWrapper: IdentityPoolWrapper) {
    new cognito.CfnUserPoolGroup(this.scope, 'admins', {
      groupName: 'admins',
      userPoolId: this.userPool.userPoolId,
      roleArn: identityPoolWrapper.adminRole.roleArn,
    });
  }
}

export class IdentityPoolWrapper extends AbstractInfrastructure {
  public adminRole: iam.Role;
  public authenticatedRole: iam.Role;
  public unAuthenticatedRole: iam.Role;

  constructor(
    scope: Stack,
    props: EnvProps,
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ) {
    super(scope, props);
    const identityPool = this.initializeIdentityPool(
      id,
      userPool,
      userPoolClient,
    );
    this.authenticatedRole = this.initializeAuthenticatedRole(identityPool);
    this.unAuthenticatedRole = this.initializeUnAuthenticatedRole(identityPool);
    this.adminRole = this.initializeAdminRole(identityPool);
    this.attachRole(
      userPool,
      userPoolClient,
      identityPool,
      this.authenticatedRole,
      this.unAuthenticatedRole,
    );
  }

  private initializeIdentityPool(
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
  ): cognito.CfnIdentityPool {
    const identityPool = new cognito.CfnIdentityPool(this.scope, id, {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });
    new CfnOutput(this.scope, 'identityPoolId', {
      value: identityPool.ref,
    });
    return identityPool;
  }

  private initializeAuthenticatedRole(
    identityPool: cognito.CfnIdentityPool,
  ): iam.Role {
    return this.initializeRole(
      identityPool,
      'CognitoDefaultAuthenticatedRole',
      'authenticated',
    );
  }

  private initializeUnAuthenticatedRole(
    identityPool: cognito.CfnIdentityPool,
  ): iam.Role {
    return this.initializeRole(
      identityPool,
      'CognitoDefaultUnAuthenticatedRole',
      'unauthenticated',
    );
  }

  private initializeAdminRole(identityPool: cognito.CfnIdentityPool): iam.Role {
    return this.initializeRole(
      identityPool,
      'CognitoAdminRole',
      'authenticated',
    );
  }

  private initializeRole(
    identityPool: cognito.CfnIdentityPool,
    roleId: string,
    roleState: 'authenticated' | 'unauthenticated',
  ): iam.Role {
    return new iam.Role(this.scope, roleId, {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': roleState,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });
  }

  private attachRole(
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
    identityPool: cognito.CfnIdentityPool,
    authenticatedRole: iam.Role,
    unAuthenticatedRole: iam.Role,
  ) {
    return new cognito.CfnIdentityPoolRoleAttachment(
      this.scope,
      'RolesAttachment',
      {
        identityPoolId: identityPool.ref,
        roles: {
          authenticated: authenticatedRole.roleArn,
          unauthenticated: unAuthenticatedRole.roleArn,
        },
        roleMappings: {
          adminsMapping: {
            type: 'Token',
            ambiguousRoleResolution: 'AuthenticatedRole',
            identityProvider: `${userPool.userPoolProviderName}:${userPoolClient.userPoolClientId}`,
          },
        },
      },
    );
  }
}
