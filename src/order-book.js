const config = require("./config");
const { OrderAction, OrderType, OrderStatus } = require("./models")


async function syncDB() {
  const res = await sendMessage(OrderAction.GET_ORDERS, {})
  // console.log(res)
  if (!res || !res.success) return
  config.setDB = res.data
}

async function createOrder(data) {
  const DB = config.getDB
  const { type, id } = data
  DB[type][id] = data
  await sendMessage(OrderAction.CREATE_ORDER, data)
}

function getOrders(payload, reply) {
  reply(null, { data: config.getDB, success: true });
}

function newOrder(payload, reply) {
  const DB = config.getDB
  const { type, id } = payload.data
  DB[type][id] = payload

  reply(null, { success: true });
}

function lockOrder(payload, reply) {
  const DB = config.getDB
  const { type, id } = payload.data

  if (!DB[type][id] || DB[type][id].isLocked) {
    reply(null, { success: false });
    return
  }

  DB[type][id].isLocked = true
  DB[type][id].lockedBy = payload.from
  reply(null, { success: true });
}

function unlockOrder(payload, reply) {
  const DB = config.getDB
  const { type, id } = payload.data

  if (!DB[type][id] || DB[type][id].lockedBy != payload.from) {
    reply(null, { success: false });
    return
  }

  DB[type][id].isLocked = false
  DB[type][id].lockedBy = undefined
  reply(null, { success: true });
}

function deleteOrder(payload, reply) {
  const DB = config.getDB
  const { type, id } = payload.data

  if (!DB[type][id] || DB[type][id].isLocked) {
    reply(null, { success: false });
    return
  }
  delete DB[type][id]

  reply(null, { success: true });
}

function getOrder(data, reply) {
  const DB = config.getDB
  const { type, id } = data

  if (!DB[type][id]) {
    reply(null, { success: false });
    return
  }

  reply(null, { data: DB[type][id], success: true });
}

function updateOrder(data, reply) {
  const DB = config.getDB
  const { type, id } = data

  if (!DB[type][id] || DB[type][id].isLocked) {
    reply(null, { success: false });
    return
  }
  DB[type][id] = data

  reply(null, { success: true });
}


async function sendMessage(action, data) {
  const from = config.getPort;
  const clientPeer = config.getClientPeer;

  console.log(`📝 ${from} :: Sending ${action.toUpperCase()} message`)
  try {
    const respone = await new Promise((resolve, reject) => {
      clientPeer.map("order-book", { action, from, data }, { timeout: 10000 }, (err, data) => {
        if (err) {
          reject(err)
          // console.log("Unnable to send message :: ", err)
        }
        resolve(data)
      });
    })

    return respone
  } catch (error) {
    return { success: false }
  }
};


async function handler(payload, reply) {
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
      console.log(`🚫 ${port} :: Invalid handler`, handler);
  }
}


async function init() {
  // stay in sync with other Grapes DB 
  await syncDB()

  // Check the DB for potential matches in 1sec interval 
  console.log(`🤖 ${config.getPort} :: Checking for potential matches...`)
  setInterval(async () => {
    const DB = config.getDB

    //  Get the best available buy order 
    let bestBuyOrder
    for (const id in DB[OrderType.BUY]) {
      const buyOrder = DB[OrderType.BUY][id]
      if (!bestBuyOrder || bestBuyOrder.price < buyOrder.price || !buyOrder.isLocked) {
        bestBuyOrder = buyOrder
      }
    }

    //  Get the best available sell order 
    let bestSellOrder
    for (const id in DB[OrderType.SELL]) {
      const sellOrder = DB[OrderType.SELL][id]
      if (!bestSellOrder || bestSellOrder.price < sellOrder.price || !sellOrder.isLocked) {
        bestSellOrder = sellOrder
      }
    }

    // Check if there are a potential macthes
    if (!bestBuyOrder || !bestSellOrder) return
    if (bestBuyOrder.price < bestSellOrder.price) return

    // Lock the Orders
    await sendMessage(OrderAction.LOCK_ORDER, bestBuyOrder)
    await sendMessage(OrderAction.LOCK_ORDER, bestSellOrder)

    deleteOrder(bestBuyOrder)
    deleteOrder(bestSellOrder)
    console.log(`\n =================================================== \n 🚨 ${port} :: Order matched \n`)
    console.log(`SELL ORDER:`, bestSellOrder)
    console.log(`BUY ORDER:`, bestBUyOrder)
    if (bestBuyOrder.qty != bestSellOrder.qty) {
      if (bestBuyOrder.qty > bestSellOrder.qty) {
        bestBuyOrder.qty = bestBuyOrder.qty - bestSellOrder.qty
        bestBuyOrder.status = OrderStatus.PARTIAL
        updateOrder(bestBuyOrder)
        await sendMessage(OrderAction.PARTIAL_ORDER, bestBuyOrder)
        await sendMessage(OrderAction.FILL_ORDER, bestSellOrder)
        await sendMessage(OrderAction.UNLOCK_ORDER, bestBuyOrder)
      } else {
        updateOrder(bestSellOrder)
        bestSellOrder.qty = bestSellOrder.qty - bestBuyOrder.qty
        bestBuyOrder.status = OrderStatus.PARTIAL
        await sendMessage(OrderAction.FILL_ORDER, bestBuyOrder)
        await sendMessage(OrderAction.PARTIAL_ORDER, bestSellOrder)
        await sendMessage(OrderAction.UNLOCK_ORDER, bestSellOrder)
      }
    } else {
      await sendMessage(OrderAction.FILL_ORDER, bestBuyOrder)
      await sendMessage(OrderAction.FILL_ORDER, bestSellOrder)
    }
  }, 1000);
}


module.exports = {
  init
}


module.exports = {
  handler,
  createOrder,
  init,
  syncDB,
}


