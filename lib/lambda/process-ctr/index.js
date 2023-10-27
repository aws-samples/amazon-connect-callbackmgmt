'use strict';
const { Buffer } = require('buffer');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const CALL_TYPE_CB = process.env.CALL_TYPE_CB;
const CB_STATUS = process.env.CB_STATUS;
const TABLE_NAME = process.env.TableName;
let db;

const handler = async (event, context, callback) => {

    if(!CALL_TYPE_CB || !CB_STATUS) {
        throw new Error('Required environment variables not found!');
    }

    console.log('processCtrFn: event =', event);

    const recordCount = Array.isArray(event?.Records) ? event.Records.length : 0;
    console.log(`processCtrFn: recordCount = ${recordCount}`);
    if(recordCount < 1) {
        console.log('processCtrFn: No records kinesis records found. Done');
        return;
    }

    db = db || new DynamoDBClient({ region: process.env.AWS_REGION, maxAttempts: 5 });
    const queueName = event.Details.ContactData.Queue.Name;

    for(const rec of event.Records) {
        const encodedData = rec?.kinesis?.data;
        if(!encodedData) continue;
        await processRecord(encodedData, queueName);
    }

} // handler

const processRecord = async (encodedData, queueName) => {

    const json = Buffer.from(encodedData, 'base64').toString('utf8');
    const data = JSON.parse(json);
    const attributes = data.Attributes;

    if(attributes?._entry !== CALL_TYPE_CB) {
        console.log('processCtrFn: Not a callback. Ignored.');
        return;
    }

    const cbStatus = attributes.CallBackStatus;
    if(cbStatus !== CB_STATUS) {
        console.warn(`processCtrFn: Unexpected callback status = [${cbStatus}].`);
        return;
    }

    const nextContactId = data.NextContactId;
    if(!nextContactId) {
        console.warn('processCtrFn: NextContactId not found.');
        return;
    }

    const phoneNo = attributes.CallbackNumber;    
    await updateCallback(phoneNo, queueName, nextContactId);
};

const updateCallback = async (phoneNo, queueName, nextContactId) => {
    
    const req = {
        TableName: TABLE_NAME,
        Key: { PhoneNumber: phoneNo, QueueName: queueName },
        UpdateExpression: 'SET NextContactId = :nextContactId',
        ExpressionAttributeValues: { ':nextContactId': { S: nextContactId } }
    };

    try {
        console.log('processCtrFn: req =', req);
        const resp = await db.send(new UpdateItemCommand(req));
        console.log('processCtrFn: data =', resp);
    } catch(ex) {
        console.error('processCtrFn: ', ex);
        throw ex;
    }

    return;
};

exports.handler = handler;