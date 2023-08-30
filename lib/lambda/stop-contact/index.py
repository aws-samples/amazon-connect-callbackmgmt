import json
import boto3
import os
import logging

client = boto3.client('connect')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    logger.info(f"EVENT: {json.dumps(event)}")
    
    nextcontactId = event['Details']['ContactData']['Attributes']['NextContactId']
    code = stop_contact(nextcontactId)
    
    return {
        'statusCode': code
    }

def stop_contact(nextcontactId):
    logger.info("Start stop_contact......")
    
    try:
        response = client.stop_contact(
            ContactId=nextcontactId,
            InstanceId=os.environ['INSTANCE_ID']
        )
       
        code = 200
    except Exception as e:
        logger.error(e)
        logger.error("Error invoking lambda to cancel callback")
        code = 100
        return code
    
    return code