'use strict';

const handler = async (event) => {

    console.log('get-10-digit-phone: event =', event);    
    const phoneNo = event.Details.Parameters.enteredPhoneNumber;
    const len = typeof phoneNo === 'string' ? phoneNo.length : 0;
    const storedPhoneNumber = { IsEmpty: "Yes" };
    
    if (len >= 10) {
        storedPhoneNumber.IsEmpty = "No"
        storedPhoneNumber.TenDigitPhoneNumber = phoneNo.substring((len - 10));
    }

    console.log('get-10-digit-phone: event: storedPhoneNumber =', storedPhoneNumber);
    return storedPhoneNumber;
}

exports.handler = handler;