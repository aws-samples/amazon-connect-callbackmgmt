'use strict';
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const handler = (event, context, callback) => {

    console.log("event:", event);
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(client);
    
    var phoneNumber = event.Details.ContactData.Attributes.CallbackNumber; //Get Callback Number
    var queue = event.Details.ContactData.Queue.Name; //Get  Queue Name
    var queueARN = event.Details.ContactData.QueueARN; //Get  Queue ARN
    const contactId = event.Details.ContactData.ContactId; //Get ContactId of the call
    console.log("Contact Id is: ", contactId, " | CallBack for: ", phoneNumber, " in the: ", queue, "Queue");

   
    var status = 'PENDING'  //HOG 05272021
    var date = new Date().toLocaleDateString('en-US', {
        timeZone: "America/New_York" //Set the time zone
    }); //Make time in readable format
    
    var time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', //Make time just use hours
        minute: '2-digit', //Add minutes to time
        timeZone: "America/New_York" //Set the time zone
    }); //Make time in readable format
    console.log("time:",time, "data:", date);
    //Load the parameters for phone number query

    //DDB TTL 
    let ts = Date.now();
    var ttl= Math.floor(ts/1000) + (+process.env.TTL_DAYS * 86400)   

    const params = {
        TableName: process.env.TableName,
        Item: {
            "dateStamp": date,
            "timeStamp": time,
            "expires": ttl,
            "PhoneNumber": phoneNumber,
            "QueueName": queue,
            "QueueARN":queueARN,
            "ContactId": contactId,    
            "NextContactId": "inprogress",
            "CallBackStatus": status //HOG 05272021
        }
    };
    //Query Dynamo for the Callback
    docClient.put(params, function(err, data) {
        if (err) { //Log any error and return CallbackWrite: Failed
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
            const callBack = JSON.stringify({ CallbackWrite: 'Failed' });
            callback(null, JSON.parse(callBack));
        }
        else { // Log update data and reutn CallbackWrite: Success
            console.log("WriteItem succeeded:", JSON.stringify(data, null, 2));
            const callBack = JSON.stringify({ CallbackWrite: 'Success' });
            callback(null, JSON.parse(callBack));
        }
    });
};

exports.handler = handler;