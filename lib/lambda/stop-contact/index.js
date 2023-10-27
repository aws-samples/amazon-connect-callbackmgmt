'use strict';
const { ConnectClient, StopContactCommand } = require('@aws-sdk/client-connect');

const INSTANCE_ID = process.env.INSTANCE_ID;
let connect;

const handler = async (event, context, callback) => {

    console.low('stopContactFn: event =', event);

    // create new connect client if not cached
    connect = connect || new ConnectClient({
        region: process.env.AWS_REGION,
        maxAttempts: 10
    });

    const contactId = event?.Details?.ContactData?.Attributes?.NextContactId;

    try {

        const resp = await connect.send(new StopContactCommand({
            ContactId: contactId,
            InstanceId: INSTANCE_ID
        }));

        console.log('stopContactFn: resp =', resp);
        const status = resp?.$metadata.httpStatusCode || -1;
        if(status < 200 || status >= 300) throw new Error(`Failed to stop contact [${contactId}]`);

        return { code: 200 };

    } catch(ex) {
        console.error('stopContactFn: error =', ex);
        return { code: 500 };
    }

} // handler

exports.handler = handler;