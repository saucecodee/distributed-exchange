let DB = {
  buy: [], // stored in increasing order, from low to high
  sell: [], // stored in decreasing order, from high to low 
}

let Port = null
let clientPeer = null
let serverPeer = null


const orderTypes = {
  SELL: "sell",
  BUY: "buy"
}

const orderStatus = {
  ACTIVE: "active",
  PARTIAL: "partial",
}

const orderActions = {
  CREATE_ORDER: "create-order",
  GET_ORDERS: "get-orders",
  LOCK_ORDER: "lock-order",
  FILL_ORDER: "fill-order",
  PARTIAL_ORDER: "partial-order",
  CANCEL_ORDER: "cancel-order",
}

function getDB() {
  return DB
}

function setDB(_DB) {
  DB = _DB
}

function getPort() {
  return Port
}

function setPort(_Port) {
  Port = _Port
}

function getClientPeer() {
  return clientPeer
}

function setClientPeer(_clientPeer) {
  clientPeer = _clientPeer
}

function getServerPeer() {
  return serverPeer
}

function setServerPeer(_serverPeer) {
  serverPeer = _serverPeer
}


module.export = {
  orderTypes,
  orderActions,

  // DB
  getDB,
  setDB,

  // Port
  getPort,
  setPort,

  // Client Peer
  getClientPeer,
  setClientPeer,

  // Server Peer
  getServerPeer,
  setServerPeer,
}