var http = require('http');
var querystring = require('querystring');

var request = require('request');
var denodeify = require('denodeify');

var defaults = require('lodash/defaults');
var assign = require('lodash/assign');

var Query = require('./query');


/**
 * The main client class.
 */
var SparqlClient = module.exports = function SparqlClient(endpoint, options) {
    var requestDefaults = {
        url: endpoint,
        method: 'POST',
        encoding: 'utf8',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/sparql-results+json,application/json',
            'User-Agent': 'node-sparql-client/' + require('../package.json').version
        }
    };
    var defaultParameters = {
        format: 'application/sparql-results+json',
        'content-type': 'application/sparql-results+json'
    };

    if (options && options.requestDefaults) {
        assign(requestDefaults, options.requestDefaults);
    }
    if (options && options.defaultParameters) {
        assign(defaultParameters, options.defaultParameters);
    }

    var doRequest = denodeify(request.defaults(requestDefaults));

    var updateEndpoint = endpoint;
    if (options && options.updateEndpoint) {
        updateEndpoint = options.updateEndpoint;
        delete options.updateEndpoint;
    }

    var that = this;

    var sparqlRequest = function sparqlRequest(query) {
        var requestOptions =
            (query.isUpdate) ?
                { form: { update: query.text }, url: updateEndpoint } :
                { form: { query: query.text } };
        defaults(requestOptions.form, defaultParameters);

        return doRequest(requestOptions)
            .then(function (response) {
                var error;
                if (response.statusCode >= 300) {
                    error = new Error(formatErrorMessage(response));
                    /* Patch .httpStatus onto the object. */
                    error.httpStatus = response.statusCode;

                    throw error;
                }

                return response;

                function formatErrorMessage(res) {
                    var code = res.statusCode;
                    var statusMessage = res.statusMessage ||
                         http.STATUS_CODES[code];

                    return 'HTTP Error: ' + code + ' ' + statusMessage;
                }
            })
            .catch(function (error) {
                if (error.code === "ECONNREFUSED") {
                    error = throw new Error("Could not connect to SPARQL endpoint.");
                    /* Add .code onto the error so consumers can use it */
                    error.code = "ECONNREFUSED";

                    throw error;
                }
                /* Rethrow the raw error. */
                throw error;
            });
    };

    this.defaultParameters = defaultParameters;
    this.requestDefaults = assign(requestDefaults, options);
    this.sparqlRequest = sparqlRequest;

    /* PREFIX xyz: <...> and BASE <...> stuff: */
    this.prefixes = Object.create(null);
};

/* SparqlClient uses #register() and #registerCommon. */
SparqlClient.prototype = Object.create(require('./registerable'));

SparqlClient.prototype.query = function query(userQuery, callback) {
    var statement = new Query(this, userQuery, {
        prefixes: this.prefixes
    });

    if (callback) {
        return statement.execute(callback);
    } else {
        return statement;
    }
};
