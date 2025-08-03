"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const messages_1 = __importDefault(require("./routes/messages"));
const images_1 = __importDefault(require("./routes/images"));
const locations_1 = __importDefault(require("./routes/locations"));
const preferences_1 = __importDefault(require("./routes/preferences"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
app.use('/api/products', products_1.default);
app.use('/api/messages', messages_1.default);
app.use('/api/images', images_1.default);
app.use('/api/locations', locations_1.default);
app.use('/api/preferences', preferences_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});
const startServer = async () => {
    try {
        await (0, database_1.connectDB)();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map