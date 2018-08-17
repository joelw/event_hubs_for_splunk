(function() {
    var fs              = require("fs");
    var path            = require("path");
    var EventHubClient  = require("azure-event-hubs").Client;
    var splunkjs        = require("splunk-sdk");
    var Promise         = require("bluebird");
    var _               = require('underscore');
    var ModularInputs   = splunkjs.ModularInputs;
    var Logger          = ModularInputs.Logger;
    var Event           = ModularInputs.Event;
    var Scheme          = ModularInputs.Scheme;
    var Argument        = ModularInputs.Argument;
    var utils           = ModularInputs.utils;

    exports.getScheme = function() {
        var scheme = new Scheme("Event Hubs");

        scheme.description = "Streams events from an Azure Event Hub.";
        scheme.useExternalValidation = true;
        scheme.useSingleInstance = false; // Set to false so an input can have an optional interval parameter.

        scheme.args = [
            new Argument({
                name: "connection_string",
                dataType: Argument.dataTypeString,
                description: "Connection string for an Event Hub",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "consumer_group",
                dataType: Argument.dataTypeString,
                description: "Event Hub Consumer Group",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "custom_filter",
                dataType: Argument.dataTypeString,
                description: "AMQP custom filter",
                requiredOnCreate: false,
                requiredOnEdit: false
            }),
            new Argument({
                name: "response_handler",
                dataType: Argument.dataTypeString,
                description: "Response handler class name",
                requiredOnCreate: false,
                requiredOnEdit: false
            })
        ];

        return scheme;
    };

    exports.validateInput = function(definition, done) {
        var connection_string = definition.parameters.connection_string;

        var client = new EventHubClient.fromConnectionString(connection_string); 
        try {
        client.open()
            .then(function() {
                return client.getPartitionIds();
            })
            .then(function(ids) {
                Logger.info("event_hubs", "Validated event hub - " + ids.length + " partitions");
                done();
            });
    } catch (e) {
        done(e);
    }

    };


    exports.streamEvents = function(name, singleInput, eventWriter, done) {
        var checkpointDir = this._inputDefinition.metadata["checkpoint_dir"];
        var connection_string = singleInput.connection_string;
        var consumer_group = singleInput.consumer_group;
        var custom_filter = singleInput.custom_filter;
        var response_handler = singleInput.response_handler;
        var alreadyIndexed = 0;
        var client = new EventHubClient.fromConnectionString(connection_string); 
        var dataInputName = name.substring(name.indexOf('://') + 3);
        var checkpointFilePath = path.join(checkpointDir, dataInputName + ".txt");

        if (response_handler == null || response_handler.length === 0) {
            response_handler = "default_message_handler";
        }

        ResponseHandler = require("./" + response_handler + ".js");

        var disconnectFunction = function() {
            Logger.info(name, "Disconnecting");
            if (!_.isUndefined(client)) {
                fs.writeFileSync(checkpointFilePath, JSON.stringify(lastOffsets));
                client.close().then(done());
            } else {
                done();
            }
        }

        var eventHubErrorHandler = function(err) {
            Logger.info(name, "Error " + err.message);
        }

        var eventHubMessageHandler = function(partition, msg) {
            var offset = msg.annotations["x-opt-offset"];
            ResponseHandler.handleMessage(msg, dataInputName, eventWriter);

            if (!_.isUndefined(this._quiescenceTimer)) {
                var d = new Date();
                clearTimeout(this._quiescenceTimer);
                this._quiescenceTimer = setTimeout(disconnectFunction, 5000);
            }
            lastOffsets[partition] = offset;
        }

        // Open checkpoint file 
        var lastOffsets = {};
        try {
                var checkpointFileContents = utils.readFile("", checkpointFilePath); 
                lastOffsets = JSON.parse(checkpointFileContents);
        } catch (e) {
                Logger.info(name, "No checkpoint file found");
        }

        client.open()
                .then(client.getPartitionIds.bind(client))
                .then(function(partitionIds) {
                        // Set default offset here 
                        return Promise.all([
                            Promise.map(partitionIds, function(partitionId) {
                                if (!(partitionId in lastOffsets)) {
                                    lastOffsets[partitionId] = 0;
                                }

                                return client.createReceiver(consumer_group, partitionId, { 'startAfterOffset' : lastOffsets[partitionId], 'customFilter': custom_filter }).then(function(receiver) {
                                    receiver.on('errorReceived', eventHubErrorHandler);
                                    receiver.on('message', eventHubMessageHandler.bind(null, partitionId));
                                });
                               })
                        ]);
                })
        .then(function() {
            var d = new Date();
            this._quiescenceTimer = setTimeout(disconnectFunction, 30000);
        })
        .catch(function(e) {
            Logger.info(name, "Got exception: " + e);
            clearTimeout(this._quiescenceTimer);
            disconnectFunction();
        });

    };

    ModularInputs.execute(exports, module);
})();
