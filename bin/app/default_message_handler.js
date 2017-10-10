(function() {
    var splunkjs        = require("splunk-sdk");
    var ModularInputs   = splunkjs.ModularInputs;
    var Event           = ModularInputs.Event;
    var _               = require('underscore');

    exports.handleMessage = function(message, stanza, eventWriter) {
        var eventTime = Date.parse(message.annotations["x-opt-enqueued-time"])
        var eventProps = _.extend(message.annotations, message.properties, message.applicationProperties, {data: message.body});
        delete eventProps["x-opt-sequence-number"];
        delete eventProps["x-opt-offset"];
        delete eventProps["x-opt-enqueued-time"];

        var event = new Event({
           stanza: stanza,
           data: eventProps,
           time: eventTime
        });
        eventWriter.writeEvent(event);
    };
})();

