const express = require('express');
const exphbs = require('express-handlebars');
const { readFile, writeFile } = require('fs').promises;
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = 8080;

const hbs = exphbs.create();

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const dataFilePath = {
    productos: path.join(__dirname, 'productos.json'),
    carritos: path.join(__dirname, 'carrito.json')
};

const readDataFile = async (dataType) => {
    try {
        const data = await readFile(dataFilePath[dataType], 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeDataFile = async (dataType, data) => {
    await writeFile(dataFilePath[dataType], JSON.stringify(data, null, 2), 'utf8');
};

const handleNotFoundError = (res, entityType) => {
    res.status(404).json({ error: `${entityType} no encontrado o no existe en la base de datos.` });
};

const productosRouter = express.Router();

productosRouter.get('/', async (req, res) => {
    const productos = await readDataFile('productos');
    res.json(productos);
});

productosRouter.get('/:pid', async (req, res) => {
    const productos = await readDataFile('productos');
    const producto = productos.find((p) => p.id === req.params.pid);

    if (producto) {
        res.json(producto);
    } else {
        handleNotFoundError(res, 'Producto');
    }
});

productosRouter.post('/', async (req, res) => {
    const productos = await readDataFile('productos');
    const nuevoProducto = {
        id: productos.length > 0 ? Math.max(...productos.map(p => Number(p.id))) + 1 : 1,
        ...req.body,
    };
    productos.push(nuevoProducto);
    await writeDataFile('productos', productos);

    io.emit('updateProducts', productos);

    res.json(nuevoProducto);
    
});

productosRouter.put('/:pid', async (req, res) => {
    const productos = await readDataFile('productos');
    const index = productos.findIndex((p) => p.id === req.params.pid);
    if (index !== -1) {
        productos[index] = { ...productos[index], ...req.body, id: req.params.pid };
        await writeDataFile('productos', productos);

        io.emit('updateProducts', productos);

        res.json(productos[index]);
    } else {
        handleNotFoundError(res, 'Producto');
    }
});

productosRouter.delete('/:pid', async (req, res) => {
    const productos = await readDataFile('productos');
    const index = productos.findIndex((p) => p.id === parseInt(req.params.pid, 10));
    if (index !== -1) {
        const deletedProduct = productos.splice(index, 1)[0];
        await writeDataFile('productos', productos);

        io.emit('updateProducts', productos);

        res.json(deletedProduct);
    } else {
        handleNotFoundError(res, 'Producto');
    }
});

app.use('/api/products', productosRouter);

const carritosRouter = express.Router();

carritosRouter.post('/', async (req, res) => {
    const carritos = await readDataFile('carritos');
    const nuevoCarrito = {
        id: Date.now().toString(),
        products: [],
    };
    carritos.push(nuevoCarrito);
    await writeDataFile('carritos', carritos);
    res.json(nuevoCarrito);
});

carritosRouter.get('/:cid', async (req, res) => {
    const carritos = await readDataFile('carritos');
    const carrito = carritos.find((c) => c.id === req.params.cid);
    res.json(carrito ? carrito.products : []);
});

carritosRouter.post('/:cid/product/:pid', async (req, res) => {
    const carritos = await readDataFile('carritos');
    const carritoIndex = carritos.findIndex((c) => c.id === req.params.cid);

    if (carritoIndex !== -1) {
        const productoId = req.params.pid;
        const carrito = carritos[carritoIndex];
        const existingProduct = carrito.products.find((p) => p.product === productoId);

        if (existingProduct) {
            existingProduct.quantity++;
        } else {
            carrito.products.push({ product: productoId, quantity: 1 });
        }

        await writeDataFile('carritos', carritos);
        res.json(carrito.products);
    } else {
        handleNotFoundError(res, 'Carrito');
    }
});

app.use('/api/carts', carritosRouter);

app.get('/', async (req, res) => {
    const productos = await readDataFile('productos');
    res.render('layouts/home', { productos });
});

app.get('/realtimeproducts', async (req, res) => {
    const productos = await readDataFile('productos');
    res.render('layouts/realTimeProducts', { productos });
});

io.on('connection', (socket) => {
    console.log('Usuario conectado');

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
