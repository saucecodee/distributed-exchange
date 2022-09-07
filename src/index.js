const { promisify } = require('util')
const { PeerRPCServer, PeerRPCClient } = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')
const OrderBook = require("./order-book")
const MatchingEngine = require("./matching-engine")
const config = require("./config")
const port = 1024 + Math.floor(Math.random() * 1000)
config.setPort(port)

//=======================================================//
//  Server configuration
//=======================================================//
const serverLink = new Link({
  grape: 'http://127.0.0.1:30001'
})
serverLink.start()

const serverPeer = new PeerRPCServer(serverLink, { timeout: 300000 })
serverPeer.init()

const service = serverPeer.transport('server')
service.listen(port)

setInterval(function () {
  serverLink.announce('order-book', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler) => {
  console.log({ payload })
  if (payload.from === port) return;
  OrderBook.handler(payload, handler.reply)
})


//=======================================================//
//  Client configuration
//=======================================================//
const clientLink = new Link({
  grape: 'http://127.0.0.1:30001'
})
clientLink.start()

const clientPeer = new PeerRPCClient(clientLink, {})
clientPeer.init()


//=======================================================//
//  Initialize Matching Engine
//=======================================================//
MatchingEngine.init()




//=======================================================//
//  
//=======================================================//
 OrderBook.createOrder(new OrderBook.Order({ 
  price: 200, 
  qty: 4, 
  type: config.orderTypes.SELL 
}))
