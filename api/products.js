const { products } = require('../lib/shop');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.status(200).json(products);
};
