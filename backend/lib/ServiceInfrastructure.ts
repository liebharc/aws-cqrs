import {
  AbstractInfrastructure as AbstractInfrastructure,
  EnvProps,
} from './AbstractInfrastructure';
import { LambdaBuilder } from './LambdaBuilder';
import { TableBuilder } from './TableBuilder';
import { BasicInfrastructure } from './BasicInfrastructure';
import { MappingTemplate } from '@aws-cdk/aws-appsync-alpha';

export class ServiceInfrastructure extends AbstractInfrastructure {
  constructor(basicInfrastructure: BasicInfrastructure, props: EnvProps) {
    super(basicInfrastructure.scope, props);
    this.createContactService(basicInfrastructure);
  }

  private createContactService(basicInfrastructure: BasicInfrastructure): void {
    const table = new TableBuilder(basicInfrastructure, {
      tableId: `Contact-${this.suffix}`,
      uniqueId: 'id',
      streaming: true,
    }).build();

    new LambdaBuilder(this.scope, {
      lambdaId: `ContactService-${this.suffix}`,
      entryPoint: 'contactservice.ts',
      environment: {
        TABLE_NAME: table.tableName,
      },
    })
      .addTopicAsEventSource(basicInfrastructure.eventBus)
      .grantReadWriteToTable(table)
      .build();

    const mutation = `mutation createNote($id: ID!, $name: String!, $completed: Boolean!) {
        createNote(id: $id, name: $name, completed: $completed) {
          id
          name
          completed
        }
      }`;

    new LambdaBuilder(this.scope, {
      lambdaId: `SubscriptionGlue-${this.suffix}`,
      entryPoint: 'subscriptionglue.ts',
      environment: {
        APP_SYNC_API_URL: basicInfrastructure.graph.url(),
        MUTATION: mutation,
      },
    })
      .addTableAsEventSource(table)
      .grantReadFromTable(table)
      .grantMutationOfGraphQL(basicInfrastructure.graph.api())
      .grantQueryOfGraphQL(basicInfrastructure.graph.api())
      .build();

    basicInfrastructure.graph.addTableDataSource(table, (dataSource) => {
      dataSource
        .addResolver(
          'Query',
          'getNoteById',
          MappingTemplate.dynamoDbGetItem('id', 'id'),
          MappingTemplate.dynamoDbResultItem(),
        )
        .addResolver(
          'Query',
          'listNotes',
          MappingTemplate.dynamoDbScanTable(),
          MappingTemplate.dynamoDbResultList(),
        )
        .addNoneResolver('Mutation', 'createNote')
        .addNoneResolver('Mutation', 'deleteNote')
        .addNoneResolver('Mutation', 'updateNote');
    });
  }
}
