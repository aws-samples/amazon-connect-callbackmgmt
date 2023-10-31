#!/usr/bin/env node

const { App } = require('aws-cdk-lib');
const { CallbackStack } = require('../lib/callback-stack');

const app = new App();
const stage = app.node.tryGetContext('stage') || 'dev';
const region = app.node.tryGetContext('region') || 'us-east-1';
const appName = app.node.tryGetContext('appName') || 'ccaas';

new CallbackStack(app, 'CallbackStack', {
  stackName: `${stage}-${appName}-callback`,
  env: { region }
});
