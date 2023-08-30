#!/usr/bin/env node

const { App, Aspects } = require('aws-cdk-lib');
const { AwsSolutionsChecks } = require('cdk-nag');
const { CallbackMgmtStack } = require('../lib/callback-mgmt-stack');

const app = new App();
const stage = app.node.tryGetContext('stage') || 'dev';
const region = app.node.tryGetContext('region') || 'us-east-1';
const seq = app.node.tryGetContext('seq') || '001';

new CallbackMgmtStack(app, 'CallbackMgmtStack', {
  stackName: `${stage}-${seq}-callbackmgmt`,
  env: { region }
});

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));