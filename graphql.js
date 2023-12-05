module.exports = function(RED) {
  // https://github.com/axios/axios
  var axios = require("axios");
  var mustache = require("mustache");
  var isPlainObject = require("lodash.isplainobject");

  var vers = "2.1.3";

  function isReadable(value) {
    return typeof value === 'object' && typeof value._read === 'function' && typeof value._readableState === 'object'
  }

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
        } else if (input[p] && Buffer.isBuffer(input[p])) {
          output[p] = "[object Buffer]";
        } else if (input[p] && isReadable(input[p])) {
          output[p] = "[object Readable]";
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

    RED.log.debug("--- GraphqlNode v" + vers + " ---");
    RED.log.debug("GraphqlNode node: " + safeJSONStringify(node));
    RED.log.trace("GraphqlNode config: " + safeJSONStringify(config));
    node.endpoint = config.endpoint;
    node.token = config.token
    RED.log.debug("node.endpoint: " + node.endpoint);
    RED.log.debug("node.token: " + node.token)
  }

  RED.nodes.registerType("graphql-server", GraphqlNode, {
    credentials: {
      token: { type: "password" },
    }
  });

  function GraphqlExecNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.graphqlConfig = RED.nodes.getNode(config.graphql);  // Retrieve the config node

    node.template = config.template;
    node.name = config.name;
    node.varsField = config.varsField || "variables";
    node.syntax = config.syntax || "mustache";
    node.showDebug = config.showDebug || false
    node.token = node.credentials.token || "";
    node.customHeaders = config.customHeaders || {}
    node.varsField = config.varsField || "variables";
    RED.log.debug("--- GraphqlExecNode ---");

    if (!node.graphqlConfig) {
      node.error("invalid graphql config");
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
      const token = node.token || node.graphqlConfig.token || "";
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      if (node.showDebug) {
        node.log(safeJSONStringify(data));
        node.log(headers.Authorization);
      }

      axios({
        method: "POST",
        url,
        headers,
        timeout: 20000,
        data: {
          query: query,
          variables: variables
        }
      })
        .then(function(response) {
          switch (true) {
            case response.status == 200 && !response.data.errors:
              node.status({
                fill: "green",
                shape: "dot",
                text: RED._("graphql.status.success")
              });
              if (!isPlainObject(node.msg.payload)) node.msg.payload = {};
              node.msg.payload.graphql = response.data.data; // remove .data to see entire response
              if (node.showDebug){
                node.msg.debugInfo = {
                  data: response.data,
                  headers,
                  query,
                  variables
                }
              }
              node.send(node.msg);
              break;
            case response.status == 200 && !!response.data.errors:
              node.status({
                fill: "yellow",
                shape: "dot",
                text: RED._("graphql.status.gqlError")
              });
              node.msg.payload.graphql = response.data.errors;
              node.send([null, node.msg]);
              break;
            default:
              node.status({
                fill: "red",
                shape: "dot",
                text: "status: " + response.status
              });
              node.msg.payload.graphql = {
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
          if (!isPlainObject(node.msg.payload)) node.msg.payload = {};
          node.msg.payload.graphql = { error };
          node.error("error: " + error);
          node.send([null, node.msg]);
        });
    }

    node.on("input", function(msg) {
      RED.log.debug("--- on(input) ---");
      RED.log.debug("msg: " + safeJSONStringify(msg));
      node.msg = msg;
      node.template = msg.template || node.template;
      node.syntax = msg.syntax || node.syntax;
      node.customHeaders = {...node.customHeaders, ...msg.customHeaders}
      var query;
      if (node.syntax === "mustache") {
        query = mustache.render(node.template, msg);
      } else {
        query = node.template;
      }
      var variables = msg[node.varsField] || {}

      callGraphQLServer(query, variables, node.customHeaders);
    });

    node.on("close", function() {
      RED.log.debug("--- closing node ---");
      node.graphqlConfig.credentials.token = node.token || "";
      RED.nodes.addCredentials(
        node.graphqlConfig,
        node.graphqlConfig.credentials
      );
    });
  }

  RED.nodes.registerType("graphql", GraphqlExecNode, {
    credentials: {
      token: { type: "password" },
    }
  });
};
