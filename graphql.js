module.exports = function(RED) {
  // https://github.com/axios/axios
  var axios = require("axios");
  var mustache = require("mustache");

  var vers = "0.2.6";

  function safeJSONStringify(input, maxDepth) {
    var output,
      refs = [],
      refsPaths = [];

    maxDepth = maxDepth || 5;

    function recursion(input, path, depth) {
      var output = {},
        pPath,
        refIdx;

      path = path || "";
      depth = depth || 0;
      depth++;

      if (maxDepth && depth > maxDepth) {
        return "{depth over " + maxDepth + "}";
      }

      for (var p in input) {
        pPath = (path ? path + "." : "") + p;
        if (typeof input[p] === "function") {
          output[p] = "{function}";
        } else if (typeof input[p] === "object") {
          refIdx = refs.indexOf(input[p]);

          if (-1 !== refIdx) {
            output[p] = "{reference to " + refsPaths[refIdx] + "}";
          } else {
            refs.push(input[p]);
            refsPaths.push(pPath);
            output[p] = recursion(input[p], pPath, depth);
          }
        } else {
          output[p] = input[p];
        }
      }

      return output;
    }

    if (typeof input === "object") {
      output = recursion(input);
    } else {
      output = input;
    }

    return JSON.stringify(output);
  }

  function GraphqlNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    //node.status({ fill:"blue", shape:"ring", text:"connecting" });
    RED.log.debug("--- GraphqlNode v" + vers + " ---");
    RED.log.debug("GraphqlNode node: " + safeJSONStringify(node));
    RED.log.trace("GraphqlNode config: " + safeJSONStringify(config));
    node.endpoint = config.endpoint;
    node.authorization = config.authorization
    RED.log.debug("node.endpoint: " + node.endpoint);
    RED.log.debug("node.authorization is specified")
  }

  RED.nodes.registerType("graphql-server", GraphqlNode, {
    credentials: {
      user: { type: "text" },
      password: { type: "password" },
      serviceTicket: { type: "password" },
      authorization: { type: "password" },
    }
  });

  function GraphqlExecNode(config) {
    RED.nodes.createNode(this, config);
    this.query = config.query;
    this.template = config.template;
    this.name = config.name;
    this.varsField = config.varsField || "variables";
    this.syntax = config.syntax || "mustache";
    this.showDebug = config.showDebug || false
    this.customHeaders = config.customHeaders || {}
    var node = this;
    RED.log.debug("--- GraphqlExecNode ---");
    //RED.log.debug('GraphqlExecNode node: ' + safeJSONStringify(node));
    //RED.log.trace('GraphqlExecNode config: ' + safeJSONStringify(config));

    // Retrieve the config node
    node.graphqlConfig = RED.nodes.getNode(config.graphql);
    var credentials = RED.nodes.getCredentials(config.graphql);
    RED.log.trace("credentials: " + safeJSONStringify(credentials));

    if (!node.graphqlConfig) {
      this.error("invalid graphql config");
    }

    // This function returns true if you have a valid Ticket, false if you don't
    function testTicket() {
      // GET /user/{username}
      RED.log.debug("--- test ticket ---");
      axios({
        method: "POST",
        url:
          node.graphqlConfig.endpoint +
          "user/" +
          node.graphqlConfig.credentials.user,
        timeout: 20000,
        headers: {
          "x-auth-token": node.graphqlConfig.credentials.serviceTicket
        }
        // withCredentials: useCredentials
      }).then(function(response) {
        RED.log.debug("response:" + response);
      });
    }

    function doLogin() {
      node.status({
        fill: "blue",
        shape: "ring",
        text: RED._("graphql.status.connecting")
      });
      RED.log.debug("--- Login (accept unauthorized) ---");
      request(
        {
          url: node.graphqlConfig.endpoint,
          method: "POST",
          json: true,
          timeout: 20000
        },
        function(error, response, body) {
          if (response) {
            switch (response.statusCode) {
              case 200:
                node.status({
                  fill: "green",
                  shape: "dot",
                  text: RED._("graphql.status.connected")
                });
                RED.log.debug("statusCode: " + response.statusCode);
                RED.log.debug("response: " + safeJSONStringify(response));
                RED.log.debug("body: " + safeJSONStringify(body));
                RED.log.debug("serviceTicket: " + body.response.serviceTicket);
                node.graphqlConfig.credentials.serviceTicket =
                  body.response.serviceTicket; // store service ticket
                RED.log.debug(
                  "updated credentials (2): " +
                    safeJSONStringify(node.graphqlConfig.credentials)
                );
                RED.nodes.addCredentials(
                  node.graphqlConfig,
                  node.graphqlConfig.credentials
                );
                RED.log.debug("body: " + safeJSONStringify(body));
                RED.log.debug("node.msg: " + safeJSONStringify(node.msg));
                node.warn("Calling send with msg: " + safeJSONStringify(node.msg));
                node.send([node.msg]);
                break;
              case 401: // token issues
                RED.log.debug("401 response: " + safeJSONStringify(response));
                if (response.body.response.errorCode) {
                  RED.log.debug(
                    "401 response.body.response.errorCode: " +
                      response.body.response.errorCode
                  );
                  switch (response.body.response.errorCode) {
                    case "RBAC": // token not recognized
                      errorMsg = RED._("graphql.errors.tokenExpLogin");
                      node.msg.payload = {
                        statusCode: response.statusCode,
                        errorCode: response.body.response.errorCode,
                        message: errorMsg,
                        detail: response.body.response.detail
                      };
                      node.error(errorMsg, node.msg);
                      node.close();
                      break;
                    case "INVALID_CREDENTIALS": // token not recognized
                      errorMsg = RED._("graphql.errors.badCreds");
                      //errorMsg = body.response.message;
                      node.status({
                        fill: "red",
                        shape: "dot",
                        text: errorMsg
                      });
                      node.msg.payload = {
                        statusCode: response.statusCode,
                        errorCode: response.body.response.errorCode,
                        message: errorMsg,
                        detail: response.body.response.detail
                      };
                      node.error(errorMsg, node.msg);
                      break;
                    default:
                      // other issue
                      errorMsg =
                        RED._("graphql.errors.error401") +
                        " " +
                        response.body.message;
                      node.status({
                        fill: "red",
                        shape: "dot",
                        text: errorMsg
                      });
                      node.msg.payload = {
                        statusCode: response.statusCode,
                        errorCode: response.body.response.errorCode,
                        message: errorMsg,
                        detail: response.body.response.detail
                      };
                      node.error(errorMsg, node.msg);
                      node.close();
                  }
                } else {
                  node.status({ fill: "red", shape: "dot", text: errorMsg });
                  node.msg.payload = {
                    statusCode: response.statusCode,
                    message: errorMsg
                  };
                  node.error(
                    "401 error, response: " + safeJSONStringify(response),
                    node.msg
                  );
                }
                break;
              case 403: // bad url, api version number
                errorMsg = RED._("graphql.errors.badRest");
                node.status({ fill: "red", shape: "dot", text: errorMsg });
                //                                node.msg.payload = response;
                node.warn("msg: " + safeJSONStringify(node.msg));
                //node.msg.payload = response;
                //delete node.msg.payload.body;
                //delete node.msg.payload.headers;
                //node.msg.response = {};
                //node.msg.response = response;
                //node.msg.response = { statusCode: 403 };
                RED.log.debug("response: " + safeJSONStringify(response));
                node.msg.payload = {
                  statusCode: response.statusCode,
                  message: errorMsg
                };
                node.warn("msg w/resp: " + safeJSONStringify(node.msg));
                node.error(errorMsg, node.msg);
                break;
              case 500: // bad credentials
                RED.log.debug(
                  "response (error 500): " + safeJSONStringify(response)
                );
                errorMsg = RED._("graphql.errors.badCreds");
                node.status({ fill: "red", shape: "dot", text: errorMsg });
                var longMsg = errorMsg;
                if (response.body.response.message) {
                  longMsg += ", " + response.body.response.message;
                }
                node.msg.payload = {
                  statusCode: response.statusCode,
                  errorCode: response.body.response.errorCode,
                  message: longMsg
                };
                node.error(errorMsg, node.msg);
                break;
              default:
                RED.log.debug("response: " + safeJSONStringify(response));
                if (response) {
                  node.warn("errorCode: " + response.statusCode);
                  RED.log.debug("response.body: " + response.body);
                  RED.log.debug(
                    "type of response.body: " + typeof response.body
                  );
                  var responseJSON;
                  try {
                    responseJSON = JSON.parse(response.body);
                    RED.log.debug(
                      "responseJSON.response: " +
                        safeJSONStringify(responseJSON.response)
                    );
                  } catch (e) {
                    RED.log.error("error parsing response: " + response.body);
                    responseJSON = null;
                  }
                  if (responseJSON && responseJSON.response.message) {
                    node.error(
                      "error message: " + responseJSON.response.message
                    );
                    node.status({
                      fill: "red",
                      shape: "dot",
                      text: responseJSON.response.message
                    });
                  } else {
                    var status = responseJSON ? responseJSON.statusCode : null;
                    node.status({
                      fill: "red",
                      shape: "dot",
                      text: RED._("graphql.status.failedConn") + status
                    });
                  }
                } // if response
                node.msg.payload = response;
              //node.error('default error, msg: ' + safeJSONStringify(node.msg), node.msg);
            } // switch
          } else {
            node.warn("Failed connecting to Graphql");
            // The response object is null
            switch (error.code) {
              case "ENOTFOUND":
                errorMsg = RED._("graphql.errors.server");
                node.status({ fill: "red", shape: "dot", text: errorMsg });
                node.error(errorMsg, node.msg);
                break;
              case "ETIMEDOUT":
                errorMsg = RED._("graphql.errors.timeout");
                node.status({ fill: "red", shape: "dot", text: errorMsg });
                node.error(errorMsg, node.msg);
                break;
              default:
                node.status({
                  fill: "red",
                  shape: "dot",
                  text: RED._("graphql.status.failed") + " " + error.code
                });
                node.error("response empty, error: " + error, node.msg);
            }
          }
        }
      );
    }

    function dataobject(context, msg){
      data = {}
      data.msg = msg;
      data.global = {};
      data.flow = {};
      g_keys = context.global.keys();
      f_keys = context.flow.keys();
      for (k in g_keys){
        data.global[g_keys[k]] = context.global.get(g_keys[k]);
      };
      for (k in f_keys){
        data.flow[f_keys[k]] = context.flow.get(f_keys[k]);
      };
      return data
    }

    function callGraphQLServer(query, variables = {}, customHeaders = {}) {
      let data = dataobject(node.context(), node.msg);
      let url = mustache.render(node.graphqlConfig.endpoint, data);
      let headers = customHeaders
      if (node.msg.authorization) {
        headers["Authorization"] = node.msg.authorization
      } else if (node.graphqlConfig.authorization) {
        headers["Authorization"] = node.graphqlConfig.authorization
      }
      node.log(safeJSONStringify(data));
      node.log(headers.Authorization);
      //RED.log.debug('callGraphQLServer, node: ' + safeJSONStringify(node));
      // RED.log.debug('callGraphQLServer, node.graphqlConfig.endpoint: ' + node.graphqlConfig.endpoint);
      // RED.log.debug('callGraphQLServer, query: ' + query);
      // RED.log.debug('callGraphQLServer, headers: ' + JSON.stringify(headers));
      // RED.log.debug('callGraphQLServer, variables: ' + JSON.stringify(variables));
      axios({
        method: "POST",
        url,
        headers,
        timeout: 20000,
        data: {
          query: query,
          variables: variables
        }
        // withCredentials: useCredentials
      })
        .then(function(response) {
          //RED.log.debug('response:' + safeJSONStringify(response, 1));
          //RED.log.debug('response.data:' + safeJSONStringify(response.data));
          //RED.log.debug('response.status:' + response.status);
          switch (true) {
            case response.status == 200 && !response.data.errors:
              node.status({
                fill: "green",
                shape: "dot",
                text: RED._("graphql.status.success")
              });
              node.msg.payload = response.data.data; // remove .data to see entire response
              if (node.showDebug){
                node.msg.debugInfo = {
                  data: response.data,
                  headers, 
                  query, 
                  variables
                }
              }
              // delete node.msg.debugInfo.data.data // remove duplicate info
              // node.msg.headers = headers
              // node.msg.query = query
              // node.msg.variables = variables
              node.send(node.msg);
              break;
            case response.status == 200 && !!response.data.errors:
              node.status({
                fill: "yellow",
                shape: "dot",
                text: RED._("graphql.status.gqlError")
              });
              node.msg.payload = response.data.errors;
              node.send([null, node.msg]);
              break;
            default:
              node.status({
                fill: "red",
                shape: "dot",
                text: "status: " + response.status
              });
              node.msg.payload = {
                statusCode: response.status,
                body: response.data
              };
              node.send([null, node.msg]);
              break;
          }
        })
        .catch(function(error) {
          RED.log.debug("error:" + error);
          node.status({ fill: "red", shape: "dot", text: "error" });
          node.msg.payload = { error };
          node.error("error: " + error);
          node.send([null, node.msg]);
        });
    }

    //*********************************
    // main function invoked on input
    //*********************************
    node.on("input", function(msg) {
      RED.log.debug("--- on(input) ---");
      RED.log.debug("msg: " + safeJSONStringify(msg));
      node.msg = msg;
      node.template = msg.template || node.template;
      node.syntax = msg.syntax || node.syntax;
      node.customHeaders = {...node.customHeaders, ...msg.customHeaders}
      //RED.log.trace('node: ' + safeJSONStringify(node));
      // RED.log.debug('node: ' + safeJSONStringify(node));
      //RED.log.trace('config: ' + safeJSONStringify(config));
      //RED.log.debug('config.query: ' + config.query);
      var query;
      if (node.syntax === "mustache") {
        query = mustache.render(node.template, msg);
      } else {
        query = node.template;
      }
      var variables = msg[node.varsField] || {}

      // Do we have a serviceTicket (in other words, have we successfully logged in)
      if (!config.token) {
        // no token so we're talking to a server that doesn't require a login
        callGraphQLServer(query, variables, node.customHeaders);
      } else if (!node.graphqlConfig.credentials.serviceTicket) {
        RED.log.debug("No ticket, but we have a token so try to login");
        doLogin(); // do the login
      } else {
        // we have a ticket
        callGraphQLServer(query, variables, node.customHeaders);
      }
    });

    node.on("close", function() {
      RED.log.debug("--- closing node ---");
      //RED.log.debug('node: ' + safeJSONStringify(node));
      //RED.log.trace('config: ' + safeJSONStringify(config));
      //RED.log.debug('pre credentials: ' + safeJSONStringify(node.graphqlConfig.credentials));
      node.graphqlConfig.credentials.serviceTicket = ""; // store service ticket
      RED.nodes.addCredentials(
        node.graphqlConfig,
        node.graphqlConfig.credentials
      );
      //RED.log.debug('post credentials: ' + safeJSONStringify(node.graphqlConfig.credentials))
    });
  }

  RED.nodes.registerType("graphql", GraphqlExecNode);
};
