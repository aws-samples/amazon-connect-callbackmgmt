const { Stack, Duration, RemovalPolicy } = require('aws-cdk-lib');
const { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } = require('aws-cdk-lib/aws-iam');
const { AttributeType, BillingMode, Table } = require('aws-cdk-lib/aws-dynamodb');
const { Code, Function, Runtime, Tracing } = require('aws-cdk-lib/aws-lambda');
const { NagSuppressions } = require('cdk-nag');
const { join, normalize } = require('path');

class CallbackMgmtStack extends Stack {
  
  constructor(scope, id, props) {

    super(scope, id, props);
    const instanceId = scope.node.tryGetContext('instance-id');
    const dataStream = scope.node.tryGetContext('data-stream');

		//-----------------------------------------------------
		// CDK-NAG SUPPRESSIONS
		//-----------------------------------------------------

		NagSuppressions.addStackSuppressions(this, [{
      id: 'AwsSolutions-IAM5',
      reason: 'Lambda execution roles need ability to write any LogStream events to its CloudWatch LogGroup.'
		}]);

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
			resources: [ `arn:aws:kinesis:${this.region}:${this.account}:stream/${dataStream}` ]
		});

		//-----------------------------------------------------
		// LAMBDA FUNCTIONS
		//-----------------------------------------------------

    const cbWriteFn = 'write-callback';
    this.getFunction(
      cbWriteFn,
      cbWriteFn,
      this.getRole(cbWriteFn, [ dbWritePolicy ]),
      Runtime.NODEJS_18_X,
      {
        TTL_DAYS: '1',
        TableName: callbacksTbl.tableName
      },
      undefined,
      1024
    );

    const cbReadFn = 'read-callback';
    this.getFunction(
      cbReadFn,
      cbReadFn,
      this.getRole(cbReadFn, [ dbReadPolicy ]),
      Runtime.NODEJS_18_X,
      { TableName: callbacksTbl.tableName },
      undefined,
      1024
    );

    const cbUpdateFn = 'update-callback';
    this.getFunction(
      cbUpdateFn,
      cbUpdateFn,
      this.getRole(cbUpdateFn, [ dbUpdatePolicy ]),
      Runtime.NODEJS_18_X,
      { TableName: callbacksTbl.tableName },
      undefined,
      1024
    );

    const getTimeFn = 'get-current-time';
    this.getFunction(
      getTimeFn,
      getTimeFn,
      this.getRole(getTimeFn),
      Runtime.NODEJS_18_X,
      undefined,
      undefined,
      512
    );

    const getTenDigitPhoneFn = 'get-10-digit-phone';
    this.getFunction(
      getTenDigitPhoneFn,
      getTenDigitPhoneFn,
      this.getRole(getTenDigitPhoneFn),
      Runtime.NODEJS_18_X,
      undefined,
      undefined,
      512
    );

    const processCtrFn = 'process-ctr';
    this.getFunction(
      processCtrFn,
      processCtrFn,
      this.getRole(processCtrFn, [ kinesisPolicy, dbUpdatePolicy ]),
      Runtime.NODEJS_18_X,
      {
        CALL_TYPE_CB: 'CallBack',
        CB_STATUS: 'PENDING',
        TableName: callbacksTbl.tableName
      },
      undefined,
      1024
    );

    const stopContactFn = 'stop-contact';
    this.getFunction(
      stopContactFn,
      stopContactFn,
      this.getRole(stopContactFn, [ connectPolicy ]),
      Runtime.NODEJS_18_X,
      { INSTANCE_ID: instanceId },
      undefined,
      1024
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

  getFunction(
		id,
		dir,
		role,
    runtime,
		environment,
		timeout = Duration.seconds(3),
		memorySize = 1024,
		tracing = Tracing.DISABLED,
		events
	) {
    const functionName = `${this.stackName}-${id}`;
		return new Function(this, `${id}`, {
			functionName,
			code: Code.fromAsset(normalize(join(__dirname, 'lambda', dir))),
			handler: 'index.handler',
			environment,
			runtime,
			role,
			timeout,
			memorySize,
			tracing,
			events
		});
	} // getNodeFunction
  
} // class

exports.CallbackMgmtStack = CallbackMgmtStack;
