# Distributed Exchange

A distributed crypto exchange using the Bitfinex Grenache RCP framework.

## Installation

- Run `npm i -g grenache-grape` to install grenache globally
- Then pull this repo and run `yarn install`

## Usage

- Boot up two grape servers by running `yarn start:grape-servers`
- Run `yarn start:exchange` on multiple terminals to create different instances of the exchnage.

## API

Here are the available API endpoints for interacting with the RPC client.

### Get Order Book

Get all orders

```
curl -X GET 'localhost:[port]/order-book/'
```

### Get One Order

Get one order type by id

```
curl -X GET 'localhost:[port]/order-book/["buy" | "sell"]/[order id]'
```

### Create Order

```
curl -X POST \
  'localhost:[port]/order-book/' \
  --header 'Content-Type: application/json' \
  --data-raw '{
  "type": ["sell" | "buy"],
  "price": [number],
  "qty": [number]
}'
```

### Cancel Order

Cancel an Order and remove it from the order book.

```
curl -X POST \
  'localhost:[port]/order-book/cancel' \
  --header 'Content-Type: application/json' \
  --data-raw '{
  "id": [string],
  "type": ["sell" | "buy"]
}'
```

### Log Order Book

Tell all exchange instances to log the current state of thier order book.

```
curl -X POST 'localhost:1800/order-book/log'
```
