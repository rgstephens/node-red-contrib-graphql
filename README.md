# node-red-contrib-graphql

A NodeRed node to execute GraphQL Queries.

## Install

Run command on Node-RED installation directory.

```
npm install node-red-contrib-graphql
```

## GraphQL Node

Provides a GraphQL node to support queries and a supporting Configuration node to point to a GraphQL server.

#### Inputs

`payload` can optionally hold values that can be used to form the GraphQL Query using the mustache template field.

#### Node Fields

| Name | Use |
|---|---|
| GraphQL Endpoint | URL to the endpoint |
| Query | Query or Mutation mustache template |

#### Outputs

`payload` is loaded with the output of the Query or Mutation. If the Query is named `getUser`, the results of the query will be in `payload.getUser`.

## ToDo's

* Add support for authentication and a token
* Test Mutations

## Installing and using the Example Flow

This example flow uses the `node-red-contrib-graphql` node to query the Deutsche Bahn GraphQL service and get a station address and details on the next departure.

The example flow is in the file `deutscheBahnFlow.json`. Import this file from the clipboad under the NodeRed menu `Import > Clipboard`.  You'll drag the example flow onto NodeRed.

![Example Flow](flow.png)

This is the result sent to the debug window.

![Example Flow Output](flowOutput.png)

## Example Queries

Here's a [list](https://github.com/APIs-guru/graphql-apis) of public GraphQL API's

### Deutsche Bahn

Endpoint: `https://developer.deutschebahn.com/free1bahnql/graphql`

```
{
   search(searchTerm: "Herrenberg") {
     stations {
       name
       stationNumber
       primaryEvaId
     }
     operationLocations {
       name
       id
       regionId
       abbrev
       locationCode
     }
   }
}
```

```
{
  stationWithEvaId(evaId: 8004168) {
    name
  }
}
```

```
{
   stationWithStationNumber(stationNumber: 6071) {
    name
    mailingAddress {
      street
      city
      zipcode
    }
    federalState
    location {
      latitude
      longitude
    }
    szentrale {
      name
      email
      number
      phoneNumber
    }
    hasParking
    timetable {
      nextDepatures {
        type
        trainNumber
        platform
        time
        stops
      }
    }
    hasWiFi
    hasParking
  }
}
```

```
{
   stationWithStationNumber(stationNumber: 2726) {
    name
    mailingAddress {
      street
      city
      zipcode
    }
    federalState
    regionalArea {
      name
    }
    szentrale {
      name
      email
      number
      phoneNumber
    }
    hasWiFi
    hasParking
   }
}
```

### http://gstephens.org:4000

**getGolferById**

```
{
  getGolferById(id: "3315181") {
    ghinNum
    firstName
    lastName
    state
    handicapIndex
    trend
  }
}
```

Template to grab GHIN Number:

```
This is the GHIN Number: {{payload.getGolferById.ghinNum}} 
```

#### getGolfers

```
{
    getGolfers(state: "WA", lastName: "Stephens", firstName: "M") {
        golferCount
        golfers {
          ghinNum
          firstName
          lastName
          trend
          handicapIndex
          email
          address1
          address2
          city
          state
          clubName
        }
    }
}
```