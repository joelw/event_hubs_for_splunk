# Event Hubs Modular Input for Splunk

Event Hubs Modular Input for Splunk is a very simple modular input that ingests
data from Azure Event Hubs. It also supports IoT Hub via their Event Hub
compatible endpoint.

It is best to set up a new consumer group for Splunk - if you re-use a consumer
group that is also being used with Event Processor Host, you'll see errors
about epochs.

If your data are structured in a way that you want to split into multiple
messages or transform or enrich before importing into Splunk, you can add and
use a custom processing class. By default all inputs use
`default_message_handler.js` but you can create a new class in the bin/app/
directory and specify the name in the input, e.g. create `custom_handler.js`
and set the input's `response_handler` to `custom_handler`. The handleMessage
function is called once per Event Hub message.

# Setup

1. Set the `SPLUNK_HOME` environment variable to the root directory of your Splunk instance.
* Copy this whole `event_hubs` folder to `$SPLUNK_HOME/etc/apps`.
* Open a terminal at `$SPLUNK_HOME/etc/apps/event_hubs/bin/app`.
* Run `npm install`.
    
* Restart Splunk

# Adding an input

1. From Splunk Home, click the Settings menu. Under **Data**, click **Data inputs**, and find `Event Hubs`. **Click Add new on that row**.
* Click **Add new** and fill in:
    * `name` (the name you want to give this input)
    * `connection_string` (the connection string for an Event Hub or an IoT Hub's Event Hub compatible endpoint
    * `consumer_group` (the name of the Event Hub consumer group)
    * (optional) `custom_filter` (an AMQP filter string)
    * (optional) `response_handler` (the name of a JavaScript file to filter event data through during ingestion)
* Save your input, and navigate back to Splunk Home.

To connect to an IoT Hub, find the endpoint through Azure Portal under IoT Hub -> Endpoints -> Events -> Event Hub-compatible
endpoint. You will also need to append EntityPath= and the Event Hub-compatible name, which is found in the field above.
