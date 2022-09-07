const { v4 } = require('uuid');
const { promisify } = require('util');
const config = require("./config");
console.log(config)
// const clientPeer = config.getClientPeer()

class Order {
  constructor({ price, qty, type, client_id, isLocked }) {
    this.id = v4();
    this.price = price;
    this.qty = qty;
    this.type = type;
    this.status = config.orderStaus.ACTIVE;
    this.isLocked = isLocked;
  }
}


function getOrders(reply) {
  reply(null, { data: config.getDB(), success: true });
}

function createOrder(payload, reply) {
  if (payload.data.type == config.orderTypes.SELL) {

  } else if (payload.data.type == config.orderTypes.BUY) {

  } else {

  }
}

function lockOrder(payload, reply) {
  const DB = config.getDB()
  const List = DB[payload.data.type]
  for (let i = (List.length - 1); i >= 0; i--) {
    if (List[i].id == payload.data.id) {
      List.splice(i, 1)
      config.setDB(DB)
      await sendMessage({
        action: config.orderActions.FILL_ORDER,
        data: {
          id: payload.data.id,
          type: payload.data.type
        }
      });
      break;
    }
  }
}

function cancelOrder(payload, reply) {

}

function createPartialOrder(payload, reply) {

}

async function fillOrder(payload, reply) {
  const DB = config.getDB()
  const List = DB[payload.data.type]
  for (let i = (List.length - 1); i >= 0; i--) {
    if (List[i].id == payload.data.id) {
      List.splice(i, 1)
      config.setDB(DB)
      await sendMessage({
        action: config.orderActions.FILL_ORDER,
        data: {
          id: payload.data.id,
          type: payload.data.type
        }
      });
      break;
    }
  }
}

// insert into sell 
// Insert into buy



const sendMessage = async (action, data) => {
  return promisify(clientPeer('order-book',
    {
      action,
      from: config.getPort(),
      data
    },
    { timeout: 10000 })
  );
};


async function handler(payload, reply) {
  switch (payload.action) {
    case config.orderActions.CREATE_ORDER:
      await createOrder(payload)
      reply(null, { success: true });
      break;
    case config.orderActions.GET_ORDERS:
      getOrders(payload, reply)
      break;
    case config.orderActions.LOCK_ORDER:
      await lockOrder(payload, reply)
      reply(null, { success: true });
      break;
    case config.orderActions.FILL_ORDER:
      await fillOrder(payload, reply)
      reply(null, { success: true });
      break;
    case config.orderActions.PARTIAL_ORDER:
      await createPartialOrder(payload, reply)
      reply(null, { success: true });
      break;
    case config.orderActions.CANCEL_ORDER:
      await cancelOrder(payload)
      reply(null, { success: true });
      break;
    default:
      console.log("🚫 :: Invalid handler", handler);
  }
}



module.exports = {
  Order,
  handler,
  createOrder
}


