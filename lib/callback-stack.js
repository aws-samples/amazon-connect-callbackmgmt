'use strict';
const { Stack, Duration, RemovalPolicy } = require('aws-cdk-lib');
const { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } = require('aws-cdk-lib/aws-iam');
const { AttributeType, BillingMode, Table } = require('aws-cdk-lib/aws-dynamodb');
const { Runtime, Tracing } = require('aws-cdk-lib/aws-lambda');
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const { join, normalize } = require('path');

class CallbackStack extends Stack {
  
  constructor(scope, id, props) {

    super(scope, id, props);

    const instanceId = scope.node.tryGetContext('instance-id');
    if(!instanceId) throw new Error('Required context parameter: instance-id');

    const streamName = scope.node.tryGetContext('stream-name');
    if(!streamName) throw new Error('Required context parameter: stream-name');

		//-----------------------------------------------------
		// DB RESOURCES
		//-----------------------------------------------------

		const callbacksTbl = new Table(this, 'SIMPLE', {
			tableName: `${this.stackName}-callbacks`,
			partitionKey: { name: 'PhoneNumber', type: AttributeType.STRING },
			sortKey: { name: 'QueueName', type: AttributeType.STRING },
			billingMode: BillingMode.PAY_PER_REQUEST,
			pointInTimeRecovery: true,
      timeToLiveAttribute: 'expires',
			removalPolicy: RemovalPolicy.DESTROY
		});

		//-----------------------------------------------------
		// IAM RESOURCES
		//-----------------------------------------------------

    const connectPolicy = new PolicyStatement({
			actions: [ 'connect:StopContact' ],
			effect: Effect.ALLOW,
			resources: [ `arn:aws:connect:${this.region}:${this.account}:instance/${instanceId}/contact/*` ]
		});

    const dbWritePolicy = new PolicyStatement({
			actions: [ 'dynamodb:PutItem' ],
			effect: Effect.ALLOW,
			resources: [ callbacksTbl.tableArn ]
		});

    const dbReadPolicy = new PolicyStatement({
			actions: [ 'dynamodb:GetItem' ],
			effect: Effect.ALLOW,
			resources: [ callbacksTbl.tableArn ]
		});

    const dbUpdatePolicy = new PolicyStatement({
			actions: [ 'dynamodb:UpdateItem' ],
			effect: Effect.ALLOW,
			resources: [ callbacksTbl.tableArn ]
		});

    const kinesisPolicy = new PolicyStatement({
			actions: [
        'kinesis:GetShardIterator',
        'kinesis:GetRecords',
        'kinesis:DescribeStream',
        'kinesis:ListShards',
        'kinesis:ListStreams'
      ],
			effect: Effect.ALLOW,
			resources: [ `arn:aws:kinesis:${this.region}:${this.account}:stream/${streamName}` ]
		});

		//-----------------------------------------------------
		// LAMBDA FUNCTIONS
		//-----------------------------------------------------

    const cbWriteFnId = 'write-callback';
    const cbWriteFn = this.createFunction(
      cbWriteFnId,
      normalize(join(__dirname, 'lambda', cbWriteFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(cbWriteFnId, [ dbWritePolicy ]),
      { TTL_DAYS: '1', TableName: callbacksTbl.tableName },
      [ '@aws-sdk/client-dynamodb' ]
    );

    const cbReadFnId = 'read-callback';
    const cbReadFn = this.createFunction(
      cbReadFnId,
      normalize(join(__dirname, 'lambda', cbReadFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(cbReadFnId, [ dbReadPolicy ]),
      { TableName: callbacksTbl.tableName },
      [ '@aws-sdk/client-dynamodb' ]
    );

    const cbUpdateFnId = 'update-callback';
    const cbUpdateFn = this.createFunction(
      cbUpdateFnId,
      normalize(join(__dirname, 'lambda', cbUpdateFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(cbUpdateFnId, [ dbUpdatePolicy ]),
      { TableName: callbacksTbl.tableName },
      [ '@aws-sdk/client-dynamodb' ]
    );

    const getTimeFnId = 'get-current-time';
    const getTimeFn = this.createFunction(
      getTimeFnId,
      normalize(join(__dirname, 'lambda', getTimeFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(getTimeFnId, [])
    );

    const getTenDigitPhoneFnId = 'get-10-digit-phone';
    const getTenDigitPhoneFn = this.createFunction(
      getTenDigitPhoneFnId,
      normalize(join(__dirname, 'lambda', getTenDigitPhoneFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(getTenDigitPhoneFnId, [])
    );

    const processCtrFnId = 'process-ctr';
    const processCtrFn = this.createFunction(
      processCtrFnId,
      normalize(join(__dirname, 'lambda', processCtrFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(processCtrFnId, [ kinesisPolicy, dbUpdatePolicy ]),
      {
        CALL_TYPE_CB: 'CallBack',
        CB_STATUS: 'PENDING',
        TableName: callbacksTbl.tableName
      },
      [ '@aws-sdk/client-dynamodb' ]
    );
    const ctrKdsEventSourceArn = 'arn:aws:kinesis:' + this.region + ':' + this.account + ':stream/' + streamName;  
    processCtrFn.addEventSourceMapping(`${processCtrFnId}-kds-event`, {
      eventSourceArn: ctrKdsEventSourceArn,
      batchSize: 100,
      startingPosition: StartingPosition.LATEST,
      enabled: true
  });

    const stopContactFnId = 'stop-contact';
    const stopContactFn = this.createFunction(
      stopContactFnId,
      normalize(join(__dirname, 'lambda', stopContactFnId, 'index.js')),
      Runtime.NODEJS_18_X,
      this.getRole(stopContactFnId, [ connectPolicy ]),
      { INSTANCE_ID: instanceId }
    );

  } // constructor

	getRole(id, statements, boundary) {
		
		const roleName = `${this.stackName}-${id}-role`;
		if(roleName.length > 64) throw Error(`Role name [${roleName}] exceeds 64 character max length!`);

    const basicPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: '*'
    });

    const policies = Array.isArray(statements) && statements.length > 0
      ? [ basicPolicy, ...statements ] : [ basicPolicy ];

		return new Role(this, `${id}-role`, {
			roleName,
			assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
			permissionsBoundary: boundary,
			inlinePolicies: {
				lambdaPermissions: new PolicyDocument({
					assignSids: true,
					statements: policies
				})
			}
		});

	} // getRole

	createFunction(
		id,
		file,
		runtime = Runtime.NODEJS_18_X,
		role,
		environment,
		nodeModules,
		externalModules,
		layers,
		timeout = Duration.seconds(3),
		memorySize = 1024,
		tracing = Tracing.DISABLED,
		events,
		minify = false,
		logRetention
	) {
		const bundling = { minify, nodeModules, externalModules };

		return new NodejsFunction(this, `${id}-fn`, {
			functionName: `${this.stackName}-${id}-fn`,
			entry: file,
			handler: 'handler',
			environment,
			runtime,
			role,
			layers,
			timeout,
			memorySize,
			tracing,
			events,
			bundling,
			logRetention
		});

	}
  
} // class

exports.CallbackStack = CallbackStack;
