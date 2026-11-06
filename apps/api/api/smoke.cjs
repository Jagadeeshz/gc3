const http = require('node:http');
const app = require('./index.cjs').default;
http.createServer(app).listen(3012, () => console.log('smoke up'));
