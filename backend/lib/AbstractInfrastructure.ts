import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';

type EnvType = 'dev' | 'staging' | 'prod';
export interface EnvProps extends StackProps {
  type: EnvType;
}

export class AbstractInfrastructure {
  public readonly scope: Stack;
  protected readonly props: EnvProps;
  public readonly envType: EnvType;
  protected readonly suffix: string;
  public readonly defaultRemovalPolicy: RemovalPolicy;

  constructor(scope: Stack, props: EnvProps) {
    if (!props.stackName) {
      throw new Error('stackName is required');
    }
    this.envType = props.type;
    this.suffix = props.stackName;
    this.scope = scope;
    this.props = props;
    this.defaultRemovalPolicy =
      this.envType == 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
  }
}
