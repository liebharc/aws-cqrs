import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AbstractInfrastructure } from './AbstractInfrastructure';

export interface Attribute {
  name: string;
  type: 'S' | 'N';
}

export interface TableBuilderProps {
  tableName?: string;
  tableId: string;
  uniqueId: Attribute | string; // We call the sortKey the uniqueId because we want to make clear that this value must be set
  primaryKey?: Attribute; // Default to 'owner'
  streaming?: boolean;
}

/*
 * Read also https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html#HowItWorks.CoreComponents.PrimaryKey
 */
export class TableBuilder {
  private readonly table: dynamodb.Table;

  constructor(
    basicInfrastructure: AbstractInfrastructure,
    props: TableBuilderProps,
  ) {
    this.table = this.createTable(
      basicInfrastructure,
      props.tableId,
      props.tableName ?? props.tableId,
      props.primaryKey ?? { name: 'owner', type: 'S' },
      props.uniqueId,
      props.streaming ?? false,
    );
  }

  private createKeyOrDefaultToString(
    key: Attribute | string,
  ): dynamodb.Attribute {
    if (typeof key === 'string') {
      return { name: key, type: dynamodb.AttributeType.STRING };
    }

    return this.createKey(key);
  }

  private createKey(key: Attribute): dynamodb.Attribute {
    return {
      name: key.name,
      type:
        key.type === 'S'
          ? dynamodb.AttributeType.STRING
          : dynamodb.AttributeType.NUMBER,
    };
  }

  private createTable(
    basicInfrastructure: AbstractInfrastructure,
    tableId: string,
    tableName: string,
    primaryKey: Attribute,
    sortKey: Attribute | string,
    streaming: boolean,
  ) {
    return new dynamodb.Table(basicInfrastructure.scope, tableId, {
      partitionKey: this.createKey(primaryKey),
      tableName: tableName,
      sortKey: this.createKeyOrDefaultToString(sortKey),
      removalPolicy: basicInfrastructure.defaultRemovalPolicy,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: streaming
        ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
        : undefined,
    });
  }

  public addGlobalSecondaryIndex(
    name: string,
    partitionKey: Attribute,
    sortKey: Attribute,
  ): TableBuilder {
    this.table.addGlobalSecondaryIndex({
      indexName: name,
      partitionKey: this.createKey(partitionKey),
      sortKey: this.createKey(sortKey),
    });
    return this;
  }

  public addLocalSecondaryIndex(
    secondaryIndex: string,
    sortKey: Attribute,
  ): TableBuilder {
    this.table.addLocalSecondaryIndex({
      indexName: secondaryIndex,
      sortKey: this.createKey(sortKey),
    });
    return this;
  }

  public build() {
    return this.table;
  }
}
