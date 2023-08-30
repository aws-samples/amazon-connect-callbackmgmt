'use strict';

const handler = async (event, context, callback) => {

    console.log('Received event:', JSON.stringify(event, null, 2));    
    const phoneNo = event.Details.Parameters.enteredPhoneNumber;
    const len = typeof phoneNo === 'string' ? phoneNo.length : 0;
    const storedPhoneNumber = { IsEmpty: "Yes" };
    
    if (len >= 10) {
        storedPhoneNumber.IsEmpty = "No"
        storedPhoneNumber.TenDigitPhoneNumber = phoneNo.substring((len - 10));
    }

    return storedPhoneNumber;
}

exports.handler = handler;