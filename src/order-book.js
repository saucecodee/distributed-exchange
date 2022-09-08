const config = require("./config");
const { OrderAction, OrderType, OrderStatus } = require("./models")


async function syncDB() {
  const res = await sendMessage(OrderAction.GET_ORDERS, {})
  if (!res || !res.success) return
  console.log("🚀 Syc DB", res)
  config.setDB = res.data[0]
}

async function createOrder(data) {
  const DB = config.getDB
  const { type = null, id = null } = data
  if (!DB[type] || DB[type][id]) return { success: false }
  DB[type][id] = data
  config.setDB = DB
  await sendMessage(OrderAction.CREATE_ORDER, data)
  return { success: true }
}

function createPartialOrder(partialOrder, fillOrder) {
  partialOrder.qty = partialOrder.qty - fillOrder.qty
  partialOrder.status = OrderStatus.PARTIAL
  updateOrder({ data: partialOrder })
  deleteOrder({ data: fillOrder })
  return { success: true }
}


//=======================================================//
//  Request handlers
//=======================================================//
function getOrders(payload, reply = () => { }) {
  reply(null, { data: config.getDB, success: true });
  return config.getDB
}

function newOrder(payload, reply = () => { }) {
  const DB = config.getDB
  const { type = null, id = null } = payload.data
  if (!DB[type] || DB[type][id]) {
    reply(null, { success: false });
    return
  }
  DB[type][id] = payload.data
  config.setDB = DB
  reply(null, { success: true });
}

function lockOrder(payload, reply = () => { }) {
  const DB = config.getDB
  const { type = null, id = null } = payload.data
  if (!DB[type] || !DB[type][id] || DB[type][id].isLocked) {
    reply(null, { success: false });
    return
  }
  DB[type][id].isLocked = true
  DB[type][id].lockedBy = payload.from
  config.setDB = DB
  reply(null, { success: true });
}

function unlockOrder(payload, reply = () => { }) {
  const DB = config.getDB
  if (!validateOrderRequest(payload).success)
    return { success: false }
  const { type, id } = payload.data
  DB[type][id].isLocked = false
  DB[type][id].lockedBy = undefined
  config.setDB = DB
  reply(null, { success: true });
}

function deleteOrder(payload, reply = () => { }) {
  const DB = config.getDB
  if (!validateOrderRequest(payload).success)
    return { success: false }
  const { type, id } = payload.data
  delete DB[type][id]
  config.setDB = DB

  reply(null, { success: true });
}

function updateOrder(payload, reply = () => { }) {
  const DB = config.getDB
  if (!validateOrderRequest(payload).success)
    return { success: false }
  const { type, id } = payload.data

  DB[type][id] = payload.data
  config.setDB = DB
  reply(null, { success: true });
}

async function sendMessage(action, data) {
  const from = config.getPort;
  const clientPeer = config.getClientPeer;

  console.log(`📝 ${from} :: Sending ${action.toUpperCase()} action for ${data.id ? data.id.slice(0, 8) : "N/A"}`)
  try {
    const respone = await new Promise((resolve, reject) => {
      clientPeer.map("order-book", { action, from, data }, { timeout: 10000 }, (err, res) => {
        if (err) {
          reject(err)
          // console.log("Unnable to send message :: ", err)
        }
        resolve(res)
        // console.log("🚨", { Message_Reply: data[0], data })
      });
    })

    return { data: respone, success: true }
  } catch (error) {
    return { success: false }
  }
};

function validateOrderRequest(payload) {
  const DB = config.getDB
  const { type = null, id = null } = payload.data

  if (!DB[type] || !DB[type][id])
    return { success: false }

  if (DB[type][id].isLocked && DB[type][id].lockedBy != payload.from)
    return { success: false }

  return { success: true }
}

async function requestHandler(payload, reply) {
  switch (payload.action) {
    case OrderAction.CREATE_ORDER:
      newOrder(payload, reply)
      break;
    case OrderAction.GET_ORDERS:
      getOrders(payload, reply)
      break;
    case OrderAction.LOCK_ORDER:
      lockOrder(payload, reply)
      break;
    case OrderAction.UNLOCK_ORDER:
      unlockOrder(payload, reply)
      break;
    case OrderAction.FILL_ORDER:
      deleteOrder(payload, reply)
      break;
    case OrderAction.PARTIAL_ORDER:
      updateOrder(payload, reply)
      break;
    case OrderAction.CANCEL_ORDER:
      deleteOrder(payload, reply)
      break;
    default:
      console.log(`🚫 ${port} :: Invalid requestH`, payload.action);
  }
}

async function initializeOrderMatching() {
  // stay in sync with other Grapes DB 
  await syncDB()

  // Check the DB for potential matches in 1sec interval 
  console.log(`🔦 ${config.getPort} :: Checking for potential matches...`)
  setInterval(async () => {
    const DB = config.getDB

    // Get the best available buy order 
    let bestBuyOrder
    for (const id in DB[OrderType.BUY]) {
      const buyOrder = DB[OrderType.BUY][id]
      if (!bestBuyOrder || bestBuyOrder.price < buyOrder.price || buyOrder.isLocked)
        bestBuyOrder = buyOrder
    }

    // Get the best available sell order 
    let bestSellOrder
    for (const id in DB[OrderType.SELL]) {
      const sellOrder = DB[OrderType.SELL][id]
      if (!bestSellOrder || bestSellOrder.price > sellOrder.price || sellOrder.isLocked)
        bestSellOrder = sellOrder
    }

    // Check if there is a potential macthes
    if (!bestBuyOrder || !bestSellOrder) return
    if (bestBuyOrder.price < bestSellOrder.price) return

    console.log(`\n =================================================== \n \n🚨 ${config.getPort} :: Fund Order match  @ ${new Date().toISOString()}\n`)
    // Lock the both Orders
    await sendMessage(OrderAction.LOCK_ORDER, bestBuyOrder)
    await sendMessage(OrderAction.LOCK_ORDER, bestSellOrder)

    // console.log(`\nORDERS DB:`, getOrders(), "\n")
    console.log("\n")
    console.log(`:: SELL ORDER:`, bestSellOrder)
    console.log(`\n:: BUY ORDER:`, bestBuyOrder)
    console.log("\n")

    if (bestBuyOrder.qty != bestSellOrder.qty) {
      const buyIsgreater = bestBuyOrder.qty > bestSellOrder.qty

      const partialOrder = buyIsgreater ? bestBuyOrder : bestSellOrder;
      const fillOrder = buyIsgreater ? bestSellOrder : bestBuyOrder;
      createPartialOrder(partialOrder, fillOrder)
      await sendMessage(OrderAction.FILL_ORDER, fillOrder)
      await sendMessage(OrderAction.PARTIAL_ORDER, partialOrder)
      await sendMessage(OrderAction.UNLOCK_ORDER, partialOrder)

    } else {
      deleteOrder({ data: bestBuyOrder })
      deleteOrder({ data: bestSellOrder })
      await sendMessage(OrderAction.FILL_ORDER, bestBuyOrder)
      await sendMessage(OrderAction.FILL_ORDER, bestSellOrder)
    }
    console.log(`\n ------------------ ORDER EXECUTED -----------------\n`)
  }, 2000);
}

module.exports = {
  initializeOrderMatching,
  requestHandler,
  createOrder,
  syncDB,
  getOrders
}


