#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/BackendStack';

const app = new cdk.App();
new BackendStack(app, 'dev', {
  stackName: 'awscqrs-Dev',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  type: 'dev',
});

new BackendStack(app, 'staging', {
  stackName: 'awscqrs-Staging',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  type: 'staging',
  terminationProtection: false,
});

new BackendStack(app, 'prod', {
  stackName: 'awscqrs-Prod',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  type: 'prod',
  terminationProtection: true,
});
