const { PeerRPCServer, PeerRPCClient } = require('grenache-nodejs-http');
const Link = require('grenache-nodejs-link');
const OrderBook = require("./order-book");

const port = 1024 + Math.floor(Math.random() * 1000)
const orderBook = new OrderBook({ port })


//=======================================================//
//  Server configuration
//=======================================================//
const serverLink = new Link({
  grape: 'http://127.0.0.1:30001'
})
serverLink.start()

const serverPeer = new PeerRPCServer(serverLink, { timeout: 300000 })
orderBook.setServerPeer(serverPeer)
serverPeer.init()

const service = serverPeer.transport('server')
service.listen(port)
console.log(`\n⚪️ ${port} :: ORDER-BOOK service is running...`)

setInterval(function () {
  serverLink.announce("exchange", service.port, {})
}, 1000)

service.on('request', async (rid, key, payload, handler) => {
  if (payload.from !== port) console.log(`\n🟠 ${port} :: INCOMING ${payload.action.toUpperCase()} from ${payload.from}${payload && payload.data && payload.data.id ? " for " + payload.data.id.slice(0, 8) : ""}`)
  await orderBook.requestHandler(payload, handler.reply)
})


//=======================================================//
//  Client configuration
//=======================================================//
const clientLink = new Link({
  grape: 'http://127.0.0.1:30001'
})
clientLink.start()

const clientPeer = new PeerRPCClient(clientLink, {})
orderBook.setClientPeer(clientPeer)
clientPeer.init()


//=======================================================//
//  Start API http server
//=======================================================//
require("./api-server")(orderBook)


//=======================================================//
//  Start Order Matching
//=======================================================//
setTimeout(async () => {
  await orderBook.initializeOrderMatching()
}, 1000);


process.on("uncaughtException", err => {
  console.error(`\n🔴 ${port} ::  Closing exchange instance... \n${err}`);
  clientLink.stop()
  throw err
  process.exit(1)
});