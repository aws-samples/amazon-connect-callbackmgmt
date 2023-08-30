'use strict';
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const handler = (event, context, callback) => {

  const client = new DynamoDBClient({ region: process.env.AWS_REGION });
  const docClient = DynamoDBDocumentClient.from(client);
  var phoneNumber = event.Details.ContactData.Attributes.CallbackNumber; //Get Callback Number
  var queue = event.Details.ContactData.Queue.Name; //Get Queue Name
  var callbackstatus = event.Details.ContactData.Attributes.CallBackStatus;
  console.log("Looking for", phoneNumber, "in the ", queue, "Queue | status: " , callbackstatus);
  
  const params = {
    TableName: process.env.TableName,
    Key: { 
          "PhoneNumber": phoneNumber,
          "QueueName": queue
    },
    UpdateExpression: 'set CallBackStatus = :x',
    ExpressionAttributeValues: {
      ':x' : callbackstatus,
    }
  };  
  
  docClient.update(params, function(err, data) {
    if (err) {// Log any error and Update Status Fail:
        console.error("Unable to Update Status. Error JSON:", JSON.stringify(err, null, 2));
        const callBack = JSON.stringify({ Cancelled: 'error' });
        callback(null, JSON.parse(callBack));
    }
    else { //Log and return Deleted: "true"
        console.log("Callback Status UpdateItem succeeded:", JSON.stringify(data, null, 2));
        const callBack = JSON.stringify({ CallBackStatus: callbackstatus });
        callback(null, JSON.parse(callBack));
    }
  });
    
  
};

exports.handler = handler;