'use strict';
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

let db;

const handler = async (event) => {
  
  console.log('update-callback: event =', event);
  db = db || new DynamoDBClient({ region: process.env.AWS_REGION, maxAttempts: 5 });

  const phoneNo = event.Details.ContactData.Attributes.CallbackNumber; //Get Callback Number
  const queue = event.Details.ContactData.Queue.Name; //Get Queue Name
  const cbStatus = event.Details.ContactData.Attributes.CallBackStatus;
  console.log(`update-callback: phoneNo = [${phoneNo}], queue = [${queue}], cbStatus = [${cbStatus}]`);
  
  const req = {
    TableName: process.env.TableName,
    Key: { PhoneNumber: { S: phoneNo }, QueueName: { S: queue } },
    UpdateExpression: 'SET CallBackStatus = :status',
    ExpressionAttributeValues: { ':status' : { S: cbStatus } }
  };

  console.log('update-callback: req =', JSON.stringify(req));
  const resp = await db.send(new UpdateItemCommand(req));
  console.log('update-callback: resp =', resp);

  const status = resp?.$metadata?.httpStatusCode || -1;
  return (status < 200 || status >= 300) ? { Cancelled: 'error' } : { CallBackStatus: cbStatus }; 
};

exports.handler = handler;