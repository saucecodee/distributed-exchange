const { PeerRPCServer, PeerRPCClient } = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')
const config = require("./config")
const OrderBook = require("./order-book")
const { OrderType, Order } = require("./models")

const port = 1024 + Math.floor(Math.random() * 1000)
config.setPort = port

//=======================================================//
//  Server configuration
//=======================================================//
const serverLink = new Link({
  grape: 'http://127.0.0.1:30001'
})
serverLink.start()

const serverPeer = new PeerRPCServer(serverLink, { timeout: 300000 })
config.setServerPeer = serverPeer
serverPeer.init()

const service = serverPeer.transport('server')
service.listen(port)

setInterval(function () {
  serverLink.announce("order-book", service.port, {})
}, 1000)

service.on('request', async (rid, key, payload, handler) => {
  if (payload.from === port) return;
  console.log(`📥 ${port} :: Incomming ${payload.action.toUpperCase()} request from ${payload.from}`)
  await OrderBook.handler(payload, handler.reply)
})


//=======================================================//
//  Client configuration
//=======================================================//
const clientLink = new Link({
  grape: 'http://127.0.0.1:30001'
})
clientLink.start()

const clientPeer = new PeerRPCClient(clientLink, {})
config.setClientPeer = clientPeer
clientPeer.init()


console.log(`⏳ ${port} :: Service is running}`)


//=======================================================//
//  Start Matching Orders
//=======================================================//
setTimeout(async () => {
  await OrderBook.init()
}, 1000);




//=======================================================//
//  
//=======================================================//
setTimeout(async () => {
  await OrderBook.createOrder(new Order({
    price: 200,
    qty: 4,
    type: OrderType.SELL,
  }))
}, 3000);



process.on("uncaughtException", err => {
  console.error(`⏳ ${port} ::  Service exiting the network: ${err}`);
  // throw err
  process.exit(1)
});
