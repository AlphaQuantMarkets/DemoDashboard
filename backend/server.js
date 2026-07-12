require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message
        });
    }
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});