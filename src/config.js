const config = {

  DB: {
    buy: {}, // stored in increasing order, from low to high
    sell: {}, // stored in decreasing order, from high to low 
  },

  Port: null,
  clientPeer: null,
  serverPeer: null,


  get getDB() {
    return this.DB
  },

  set setDB(_DB) {
    this.DB = _DB
  },

  get getPort() {
    return this.Port
  },

  set setPort(_Port) {
    this.Port = _Port
  },

  get getClientPeer() {
    return this.clientPeer
  },

  set setClientPeer(_clientPeer) {
    this.clientPeer = _clientPeer
  },

  get getServerPeer() {
    return this.serverPeer
  },

  set setServerPeer(_serverPeer) {
    this.serverPeer = _serverPeer
  },
}

module.exports = config