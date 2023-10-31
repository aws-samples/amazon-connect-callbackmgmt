'use strict';

const handler = async () => {
    const utcTime = new Date().toISOString();
    console.log(`getDateTime: utcTime = ${utcTime}`);
    return { utcTime };
}

exports.handler = handler;