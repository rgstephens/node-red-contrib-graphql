# node-red-contrib-graphql

[![Platform](https://img.shields.io/badge/platform-Node--RED-red)](https://nodered.org)
![Release](https://img.shields.io/npm/v/node-red-contrib-graphql.svg)
![NPM](https://img.shields.io/npm/dm/node-red-contrib-graphql.svg)

A NodeRed node to execute GraphQL Queries.

## Install

Run command on Node-RED installation directory.

```
npm install node-red-contrib-graphql
```

## Change Log

| Vers  | Changes                                                                                                                                                                                                                                                                                   | Date        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| 2.0.0 | GraphQL response is now on `payload.graphql` instead of replacing `payload`. **This is a breaking change.** Addresses #32                                                                                                                                                                 | Dec 7 2022  |
| 1.4.1 | Bump `follow-redirects` to 1.14.8                                                                                                                                                                                                                                                         | Dec 7 2022  |
| 1.4.0 | improve debug, bump `follow-redirects`                                                                                                                                                                                                                                                    | Jan 30 2022 |
| 1.3.0 | bump axios to address CVE-2021-3749                                                                                                                                                                                                                                                       | Oct 27 2021 |
| 1.2.0 | [Fix node not showing in palette](https://github.com/rgstephens/node-red-contrib-graphql/pull/24), bump axios                                                                                                                                                                             | Sep 14 2021 |
| 1.1.0 | [Error Handling & Config Templates](https://github.com/rgstephens/node-red-contrib-graphql/pull/11/), [showDebug & customHeaders](https://github.com/rgstephens/node-red-contrib-graphql/pull/22/conflicts), [Bump axios](https://github.com/rgstephens/node-red-contrib-graphql/pull/20) | Jul 15 2021 |
| 1.0.0 | pass Authorization via msg.authorization, [PR #21](https://github.com/rgstephens/node-red-contrib-graphql/pull/21)                                                                                                                                                                        |             | Jul 15 2021 |
| 0.0.6 | Initial Release                                                                                                                                                                                                                                                                           | Jun 4 2018  |

## GraphQL Node

Provides a `GraphQL` node to support queries and a supporting Configuration node, called `graphql-server` to point to a GraphQL server.

### `graphql-server` Configuration Node Fields

| Name          | Use                 |
| ------------- | ------------------- |
| Name          | Node Name           |
| Endpoint      | URL to the endpoint |
| Authorization | Header              |

### `graphql` Function Node Fields

| Name       | Use                        |
| ---------- | -------------------------- |
| Name       | Node Name                  |
| Endpoint   | Configuration Node Name    |
| Query      | Query or Mutation template |
| Syntax     | Mustache / plain           |
| Show Debug | Enable debug               |

## Installing and using the Example Flow

This example flow uses the `node-red-contrib-graphql` node to query the Deutsche Bahn GraphQL service and get a station address and details on the next departure.

The example flow is in the file `countries.json`. Import this file from the clipboard under the NodeRed menu `Import > Clipboard`. You'll drag the example flow onto NodeRed.

![Example Flow](flow.png)

This is the result sent to the debug window.

![Example Flow Output](flowOutput.png)

### Countries API

Here is the example using the [Countries API](https://github.com/trevorblades/countries) built by GitHub user [Trevor Blades](https://github.com/trevorblades), who used [Countries List](https://annexare.github.io/Countries/) as a source of data.

The GraphQL endpoint for this API is `https://countries.trevorblades.com/`

```json
# Get information on Germany and it's states
{
  country(code: "DE") {
    name
    native
    capital
    currency
    phone
    states {
      code
      name
    }
  }
}
```

![Edit GraphQL Node](editGraphQL.png)

## Template flavors and uses

There are two template flavors:

1. Plain
2. Mustache

At the bottom of the template text area, you must select between plain or mustache template.

If you select mustache, your template will be processed by Mustache with the message's payload as an argument. I.e.

```
submitted_template = mustache("template in text area", msg.payload)
```

If you select plain, the template is left as it is.

### Template variables

You can add GraphQL query variables to the submitted query by defining them in the `msg.variables` property.
Your variables will be passed over to the GraphQL query.

For example, if you define

```
type Response {
  ok: boolean
}

input doSomethingInput {
  myVar: String
}

type Mutation {
  doSomething(input: doSomethingInput!): Response
}

```

you can pass the `messageInput` parameter as such in Node-Red msg:

```
msg.variables = {
  "input": {
    "myVar": "myValue"
  }
}
```

it will be added to the GraphQL query:

```
query: `mutation doSomething($input: messageInput!) {
  doSomething(input: $input) {
    ok
  }
}`,
variables: {
  input: {
    myVar: "myValue"
  }
}
```

When using a scalar type like [JSON](https://github.com/taion/graphql-type-json), the entire payload can conveniently be
passed as an input parameter:

```
scalar JSON

type Response {
  ok: boolean
}

input payloadInput {
  payload: JSON
}

type Mutation {
  doSomething(input: payloadInput!): Response
}

```

In node-red flow, prepare `payloadInput` variables:

```
msg.variables = {
  "input": {
    "payload": msg.payload
  }
}
```

which will results in

```
query: `mutation doSomething($input: payloadInput!) {
  doSomething(input: $input) {
    ok
  }
}`,
variables: {
  input: {
    myVar: { whatever: "was in you msg.payload", val: 5, bool: true }
  }
}
```

The execution will return the value in:

```
msg.payload.doSomething
```

object.

### Outputs

`payload` is loaded with the output of the Query or Mutation. If the Query is named `doSomething`, the results of the query will be in `payload.doSomething`.

```
//msg.payload is:
{
  doSomething: {
    ok: true
  }
}
```
