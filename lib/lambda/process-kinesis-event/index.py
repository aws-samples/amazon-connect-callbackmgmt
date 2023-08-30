import boto3
import json
import os
import logging
import base64
import datetime
import random
import time


logger = logging.getLogger()
logger.setLevel(logging.getLevelName(os.environ["LOGGING_LEVEL"]))


def handler(event, context):
    try:
        # logger.info('Event: {}'.format(event))
        invoke_sfExec_async(event, context)
 
    except Exception as e:
        return  {'response': 'Still success' }

def invoke_sfExec_async(event, context):
    
    #for each record in Kinesis records, invoke a new Lambda function to process it async
    for record in event['Records']:
        payload = record['kinesis']['data']
        process_ctr_record(payload)

def process_ctr_record(record):
    
    decoded_payload = base64.b64decode(record).decode('utf-8')
    record_obj = json.loads(decoded_payload)
    logger.info('DecodedPayload: {}'.format(record_obj))
    
    try:
        if record_obj['Attributes'] is not None: 
            if '_entry' in record_obj['Attributes']:
                if record_obj['Attributes']['_entry'] == os.environ['CALL_TYPE_CB']:
                    if record_obj['Attributes']['CallBackStatus'] == os.environ["CB_STATUS"]:
                        logger.info('Callback call event found.....')
                        if none_or_empty(record_obj['NextContactId']):
                            logger.info("NextContactId is either None or empty")
                        else:
                            logger.info('NextContactId is %s' % record_obj['NextContactId'])
                            update_nextContactId(record_obj)
                            time.sleep(10)
                
                else:
                    logger.info('NOT a Callback ctr event.....')
            else:
                logger.info('NOT a Callback ctr event.....')
        else:
                logger.info('No Attributes on this call.....')
    except Exception as e:
        logger.error(e + "Error in process_ctr_record")
        raise e 

def none_or_empty(variable):
	return True if not variable else False
	
def update_nextContactId(record_obj):
    logger.info('update_nextContactId started..........')
 
    try:
        table = boto3.resource('dynamodb').Table(os.environ["TABLE_NAME"])
        
        phone_number = record_obj['Attributes']['CallbackNumber']
        next_contact_id = record_obj['NextContactId']
        queue_name = record_obj['Attributes']['QueueName']

        UpdateExpression = 'SET NextContactId = :val1'
        ExpressionAttributeValues = {':val1': next_contact_id }
        
        response = table.update_item(
            Key={'PhoneNumber': phone_number, 'QueueName':queue_name},
            UpdateExpression=UpdateExpression,
            ExpressionAttributeValues=ExpressionAttributeValues
        )
        
        logger.info(f"response: {response}")
    except Exception as e:
        print(e)
        print("An exception occurred") 
    
