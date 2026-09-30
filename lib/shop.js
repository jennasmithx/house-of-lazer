const products = require('../data/products.json');
const services = require('../data/services.json');

const MAX_QTY = 20;
const deliveryFee = () => Number(process.env.DELIVERY_FEE ?? 95);

// Prices a cart from the server-side catalogue. Throws a user-facing message
// on anything invalid; nothing the browser sends about price is trusted.
function priceCart(items, fulfilment) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Your cart is empty.');
  if (items.length > 50) throw new Error('Too many items in your cart.');
  const lines = items.map((item) => {
    const product = products.find((p) => p.id === item?.id);
    const qty = Number(item?.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new Error('Your cart contains an invalid item. Please refresh and try again.');
    }
    return { product_id: product.id, name: product.name, price: product.price, qty };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const delivery = fulfilment === 'delivery' ? deliveryFee() : 0;
  return { lines, subtotal, deliveryFee: delivery, total: subtotal + delivery };
}

module.exports = { products, services, deliveryFee, priceCart, MAX_QTY };
