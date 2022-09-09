const { OrderAction, OrderType, OrderStatus } = require("./models")

class OrderBook {
  DB = {
    buy: {},
    sell: {},
  }
  clientPeer = null
  serverPeer = null

  constructor({ port }) {
    this.port = port
  }

  setClientPeer(clientPeer) {
    this.clientPeer = clientPeer
  }

  setServerPeer(serverPeer) {
    this.serverPeer = serverPeer
  }

  async syncOrderBook() {
    const res = await this.sendMessage(OrderAction.GET_ORDERS, {})
    if (!res || !res.success)
      return { success: false }
    for (let i = 0; i < res.data.length; i++) {
      if (res.data[i].data) {
        this.DB = res.data[i].data
        break;
      }
    }
    console.log(`\n⚪️ ${this.port} :: ORDER BOOK ${JSON.stringify(this.DB, null, 2)}`)

    return { success: true }
  }

  async createOrder(data) {
    const { type = null, id = null } = data
    if (!this.DB[type] || this.DB[type][id]) return { success: false }
    this.DB[type][id] = data
    await this.sendMessage(OrderAction.CREATE_ORDER, data)
    return { success: true, data }
  }

  async cancelOrder(payload, reply = () => { }, isRemoteCall) {
    if (payload.from != this.port)
      this.deleteOrder(payload)
    if (isRemoteCall)
      await this.sendMessage(OrderAction.CANCEL_ORDER, payload.data)

    reply(null, { success: true });
    return { success: true }
  }

  async logOrderBook(payload, reply = () => { }, isRemoteCall) {
    if (isRemoteCall)
      await this.sendMessage(OrderAction.LOG_ORDER_BOOK)
    if (!payload || payload.from != this.port)
      console.log(`\n⚪️ ${this.port} :: ORDER BOOK ${JSON.stringify(this.DB, null, 2)}`)

    reply(null, { success: true })
    return { success: true }
  }

  createPartialOrder(partialOrder, fillOrder) {
    partialOrder.qty = partialOrder.qty - fillOrder.qty
    partialOrder.status = OrderStatus.PARTIAL
    this.updateOrder({ data: partialOrder })
    this.deleteOrder({ data: fillOrder })
    return { success: true }
  }

  getOrder({ type, id }) {
    if (!this.DB[type] || !this.DB[type][id])
      return { success: false }
    return { success: true, data: this.DB[type][id] }
  }

  getOrderBook(payload, reply = () => { }) {
    if (payload.from == this.port) {
      reply(null, { data: null, success: true });
    } else {
      reply(null, { data: this.DB, success: true });
    }

    return { data: this.DB, success: true }
  }

  newOrder(payload, reply = () => { }) {
    const { type = null, id = null } = payload.data
    if (!this.DB[type] || this.DB[type][id]) {
      reply(null, { success: false });
      return
    }
    this.DB[type][id] = payload.data
    reply(null, { success: true });
  }

  lockOrder(payload, reply = () => { }) {
    const { type = null, id = null } = payload.data
    if (!this.DB[type] || !this.DB[type][id] || this.DB[type][id].isLocked) {
      reply(null, { success: false });
      return
    }
    this.DB[type][id].isLocked = true
    this.DB[type][id].lockedBy = payload.from
    reply(null, { success: true });
  }

  unlockOrder(payload, reply = () => { }) {
    if (!this.validateOrderRequest(payload).success)
      return { success: false }
    const { type, id } = payload.data
    this.DB[type][id].isLocked = false
    this.DB[type][id].lockedBy = undefined
    reply(null, { success: true });
  }

  deleteOrder(payload, reply = () => { }) {
    if (!this.validateOrderRequest(payload).success)
      return { success: false }
    const { type, id } = payload.data
    delete this.DB[type][id]
    reply(null, { success: true });
  }

  updateOrder(payload, reply = () => { }) {
    if (!this.validateOrderRequest(payload).success)
      return { success: false }
    const { type, id } = payload.data

    this.DB[type][id] = payload.data
    reply(null, { success: true });
  }

  async sendMessage(action, data = {}) {
    console.log(`\n🟢 ${this.port} :: Outgoing ${action.toUpperCase()}${data.id ? " for " + data.id.slice(0, 8) : ""}`)
    try {
      const respone = await new Promise((resolve, reject) => {
        this.clientPeer.map("exchange", { action, from: this.port, data }, { timeout: 10000 }, (err, res) => {
          if (err) {
            return reject(err)
          }
          return resolve(res)
        });
      })

      // console.log(respone)
      return { data: respone, success: true }
    } catch (error) {
      console.log("Unnable to send message :: ", error)
      return { success: false }
    }
  };

  validateOrderRequest(payload) {
    const { type = null, id = null } = payload.data

    if (!this.DB[type] || !this.DB[type][id])
      return { success: false }

    if (this.DB[type][id].isLocked && this.DB[type][id].lockedBy != payload.from)
      return { success: false }

    return { success: true }
  }

  async requestHandler(payload, reply) {
    switch (payload.action) {
      case OrderAction.CREATE_ORDER:
        this.newOrder(payload, reply)
        break;
      case OrderAction.GET_ORDERS:
        this.getOrderBook(payload, reply)
        break;
      case OrderAction.LOCK_ORDER:
        this.lockOrder(payload, reply)
        break;
      case OrderAction.UNLOCK_ORDER:
        this.unlockOrder(payload, reply)
        break;
      case OrderAction.FILL_ORDER:
        this.deleteOrder(payload, reply)
        break;
      case OrderAction.PARTIAL_ORDER:
        this.updateOrder(payload, reply)
        break;
      case OrderAction.CANCEL_ORDER:
        this.deleteOrder(payload, reply)
        break;
      case OrderAction.LOG_ORDER_BOOK:
        this.logOrderBook(payload, reply)
        break;
      default:
        console.log(`🚫 ${port} :: Invalid requestH`, payload.action);
    }
  }

  async initializeOrderMatching() {
    // Stay in sync with other Grapes DB 
    const sync = await this.syncOrderBook()
    if (!sync.success) throw new Error("Unable to sycn order book")

    // Check the DB for potential matches in 1sec interval 
    console.log(`\n🚨  ${this.port} :: Order matcher is running...`)
    setInterval(async () => {
      // Get the best available buy order 
      let bestBuyOrder
      for (const id in this.DB[OrderType.BUY]) {
        const buyOrder = this.DB[OrderType.BUY][id]
        if (!bestBuyOrder || bestBuyOrder.price < buyOrder.price || buyOrder.isLocked)
          bestBuyOrder = buyOrder
      }
      // Get the best available sell order 
      let bestSellOrder
      for (const id in this.DB[OrderType.SELL]) {
        const sellOrder = this.DB[OrderType.SELL][id]
        if (!bestSellOrder || bestSellOrder.price > sellOrder.price || sellOrder.isLocked)
          bestSellOrder = sellOrder
      }

      // Check if there is a potential macthes
      if (!bestBuyOrder || !bestSellOrder) return
      if (bestBuyOrder.price < bestSellOrder.price) return

      console.log(`\n =================================================== \n \n🚨 ${this.port} :: Fund Order match  @ ${new Date().toISOString()}`)
      // Lock the both Orders
      const lockSellOrder = await this.sendMessage(OrderAction.LOCK_ORDER, bestSellOrder)
      const lockBuyorder = await this.sendMessage(OrderAction.LOCK_ORDER, bestBuyOrder)

      let lockStatus = true
      for (let i = 0; i < lockSellOrder.length; i++) {
        lockStatus = lockSellOrder[i].success && lockBuyorder[i].success
        if (!lockStatus) {
          await this.sendMessage(OrderAction.UNLOCK_ORDER, bestSellOrder)
          await this.sendMessage(OrderAction.UNLOCK_ORDER, bestBuyOrder)
          break;
        }
      }


      // console.log(`\nORDERS DB:`, getOrderBook().data, "\n")
      console.log(`\n⚪️ ${this.port} :: SELL ORDER ::`, bestSellOrder)
      console.log(`\n⚪️ ${this.port} :: BUY ORDER ::`, bestBuyOrder)

      if (bestBuyOrder.qty != bestSellOrder.qty) {
        const buyIsgreater = bestBuyOrder.qty > bestSellOrder.qty

        const partialOrder = buyIsgreater ? bestBuyOrder : bestSellOrder;
        const fillOrder = buyIsgreater ? bestSellOrder : bestBuyOrder;
        this.createPartialOrder(partialOrder, fillOrder)
        await this.sendMessage(OrderAction.FILL_ORDER, fillOrder)
        await this.sendMessage(OrderAction.PARTIAL_ORDER, partialOrder)
        await this.sendMessage(OrderAction.UNLOCK_ORDER, partialOrder)

      } else {
        this.deleteOrder({ data: bestBuyOrder })
        this.deleteOrder({ data: bestSellOrder })
        await this.sendMessage(OrderAction.FILL_ORDER, bestBuyOrder)
        await this.sendMessage(OrderAction.FILL_ORDER, bestSellOrder)
      }
      console.log(`\n ------------------ ORDER EXECUTED -----------------\n`)
    }, 2000);
  }

}
module.exports = OrderBook


