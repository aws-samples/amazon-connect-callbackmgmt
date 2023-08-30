'use strict';
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const handler = (event, context, callback) => {

    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(client);
    var phoneNumber = event.Details.ContactData.Attributes.CallbackNumber;
    var queue = event.Details.ContactData.Queue.Name;
    console.log("Looking for callback for", phoneNumber, "in the", queue, "Queue");

    const params = {
        TableName: process.env.TableName,
        KeyConditionExpression: "PhoneNumber = :phoneNumber and QueueName = :queue",
        ExpressionAttributeValues: {
            ":phoneNumber": phoneNumber,
            ":queue": queue
        }
    };
    console.log(params);
    docClient.query(params, function(err, data) {
        console.log(data);
        if (err) {
            console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
        }
        else {
            //Check if number and queue is in the database
            if (!data.Items[0]) { // Return Cancelled: false if the PhoneNumber and QueueName is missing
                console.log("Did not find", phoneNumber, "in the ", queue, "Queue");
                const callBack = JSON.stringify({ CallBackStatus: "NotFound" });
                callback(null, JSON.parse(callBack));
            }
            else { // Return Callback: true if the PhoneNumber and QueueName is present
                console.log("Found callback");                
                const callBack = JSON.stringify({ CallBackStatus: data.Items[0].CallBackStatus, NextContactId: data.Items[0].NextContactId, Time: data.Items[0].timeStamp, Date: data.Items[0].dateStamp });
                callback(null, JSON.parse(callBack));
            }
        }
    });
};

exports.handler = handler;