import { Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as appsyncalpha from '@aws-cdk/aws-appsync-alpha';
import { join } from 'path';

export interface LambdaBuilderProps {
  lambdaName?: string;
  entryPoint?: string;
  lambdaId: string;
  environment?: {
    [key: string]: string;
  };
}

export class LambdaBuilder {
  private readonly lambda: lambdaNodejs.NodejsFunction;
  private deadLetterQueue: sqs.Queue | undefined;
  private scope: Stack;

  constructor(scope: Stack, props: LambdaBuilderProps) {
    this.lambda = this.createLambda(
      scope,
      props.lambdaName ?? props.lambdaId,
      props.entryPoint ?? null,
      props.lambdaId,
      props.environment,
    );
    this.scope = scope;
  }

  private createLambda(
    scope: Stack,
    lambdaName: string,
    entryPoint: string | null,
    lambdaId: string,
    environment?: {
      [key: string]: string;
    },
  ): lambdaNodejs.NodejsFunction {
    return new lambdaNodejs.NodejsFunction(scope, lambdaId, {
      entry: join(__dirname, '..', 'src', entryPoint ?? `${lambdaName}.ts`),
      handler: 'handler',
      functionName: lambdaId,
      environment: environment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        environment: {
          NODE_ENV: 'production',
        },
        externalModules: ['aws-sdk', 'aws-lambda'],
        nodeModules: ['graphql'],
      },
    });
  }

  public addUserPoolAdminAccess(userPool: cognito.UserPool): LambdaBuilder {
    this.lambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminGetUser'],
        resources: [userPool.userPoolArn],
      }),
    );
    return this;
  }

  public grantWriteToTable(table: dynamodb.Table): LambdaBuilder {
    table.grantWriteData(this.lambda);
    return this;
  }

  public grantReadFromTable(table: dynamodb.Table): LambdaBuilder {
    table.grantReadData(this.lambda);
    return this;
  }

  public grantReadWriteToTable(table: dynamodb.Table): LambdaBuilder {
    table.grantReadWriteData(this.lambda);
    return this;
  }
  public addQueueAsEventSource(queue: sqs.Queue) {
    this.lambda.addEventSource(new lambdaEventSources.SqsEventSource(queue));
    return this;
  }
  public grantMutationOfGraphQL(graphQL: appsyncalpha.GraphqlApi) {
    graphQL.grantMutation(this.lambda);
    return this;
  }
  public grantQueryOfGraphQL(graphQL: appsyncalpha.GraphqlApi) {
    graphQL.grantQuery(this.lambda);
    return this;
  }
  public addTopicAsEventSource(
    topic: sns.Topic,
    deadLetterQueue?: sqs.Queue,
    filterPolicy?: (filters: SubscriptionFilterBuilder) => void,
  ) {
    const filters = new SubscriptionFilterBuilder();
    if (filterPolicy) {
      filterPolicy(filters);
    }

    if (!deadLetterQueue) {
      deadLetterQueue = this.createDefaultDeadLetterQueue(topic.fifo);
    }

    if (topic.fifo) {
      const queue = new sqs.Queue(
        this.scope,
        `InboxQueue-${this.lambda.node.id}.fifo`,
        {
          queueName: `InboxQueue-${this.lambda.node.id}.fifo`,
          fifo: true,
        },
      );

      topic.addSubscription(
        new snsSubscriptions.SqsSubscription(queue, {
          filterPolicy: filters.build(),
          deadLetterQueue,
        }),
      );

      this.lambda.addEventSource(new lambdaEventSources.SqsEventSource(queue));
      return this;
    } else {
      this.lambda.addEventSource(
        new lambdaEventSources.SnsEventSource(topic, {
          filterPolicy: filters.build(),
        }),
      );
      return this;
    }
  }
  public addTableAsEventSource(table: dynamodb.Table) {
    this.lambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
      }),
    );
    return this;
  }

  private createDefaultDeadLetterQueue(fifo: boolean) {
    if (!this.deadLetterQueue) {
      if (fifo) {
        this.deadLetterQueue = new sqs.Queue(
          this.scope,
          `DeadLetterQueue-${this.lambda.node.id}.fifo`,
          {
            queueName: `DeadLetterQueue-${this.lambda.node.id}.fifo`,
            fifo: true,
          },
        );
      } else {
        this.deadLetterQueue = new sqs.Queue(
          this.scope,
          `DeadLetterQueue-${this.lambda.node.id}`,
          {
            queueName: `DeadLetterQueue-${this.lambda.node.id}`,
          },
        );
      }
      this.deadLetterQueue.grantSendMessages(this.lambda);
    }

    return this.deadLetterQueue;
  }

  public grantSendMessagesToQueue(queue: sqs.Queue) {
    queue.grantSendMessages(this.lambda);
    return this;
  }

  public grantPublishToTopic(topic: sns.Topic) {
    topic.grantPublish(this.lambda);
    return this;
  }

  public build() {
    return this.lambda;
  }
}
export class SubscriptionFilterBuilder {
  private readonly filterPolicy: {
    [attribute: string]: sns.SubscriptionFilter;
  } = {};

  public addFilter(attribute: string, filter: sns.SubscriptionFilter) {
    this.filterPolicy[attribute] = filter;
  }

  public build() {
    if (this.filterPolicy) {
      return this.filterPolicy;
    }
    return undefined;
  }
}
