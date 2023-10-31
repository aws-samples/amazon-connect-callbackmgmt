'use strict';
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

let db;

const handler = async (event) => {

    console.log('write-callback: event =', event);
    db = db || new DynamoDBClient({ region: process.env.AWS_REGION, maxAttempts: 5 });
    
    const phoneNumber = event.Details.ContactData.Attributes.CallbackNumber; //Get Callback Number
    const queue = event.Details.ContactData.Queue.Name; //Get  Queue Name
    const queueARN = event.Details.ContactData.Queue.ARN; //Get  Queue ARN
    const contactId = event.Details.ContactData.ContactId; //Get ContactId of the call
    console.log(`write-callback: phoneNumber = [${phoneNumber}], queue = [${queue}]`);
   
    var date = new Date().toLocaleDateString('en-US', {
        timeZone: 'America/New_York' //Set the time zone
    }); //Make time in readable format
    
    var time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', //Make time just use hours
        minute: '2-digit', //Add minutes to time
        timeZone: 'America/New_York' //Set the time zone
    }); //Make time in readable format
    console.log('write-callback: time = [', time, '], date = [', date, ']');

    //DDB TTL 
    const ts = Date.now();
    const ttl= Math.floor(ts/1000) + (+process.env.TTL_DAYS * 86400)   
    console.log(`write-callback: ts = [${ts}], ttl = [${ttl}]`);

    const req = {
        TableName: process.env.TableName,
        Item: {
            'dateStamp': { S: date },
            'timeStamp': { S: time },
            'expires': { N: '' + ttl },
            'PhoneNumber': { S: phoneNumber },
            'QueueName': { S: queue },
            'QueueARN': { S: queueARN },
            'ContactId': { S: contactId },    
            'NextContactId': { S: 'inprogress' },
            'CallBackStatus': { S: 'PENDING' }
        }
    };

    console.log('write-callback: req =', JSON.stringify(req));
    const resp = await db.send(new PutItemCommand(req));
    console.log('write-callback: resp =', resp);
    const status = resp?.$metadata?.httpStatusCode || -1;
    return (status < 200 || status >= 300) ? { CallBackStatus: 'ERROR' } : { CallBackStatus: 'PENDING' };  
};

exports.handler = handler;