const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/signup", async (req, res) => {

    console.log("===== SIGNUP REQUEST =====");
    console.log(req.body);

    const { username, password } = req.body;

    try {
        const result = await pool.query(
            `
            INSERT INTO users(username, password)
            VALUES ($1, $2)
            RETURNING *
            `,
            [username, password]
        );

        res.status(201).json(result.rows[0]);

    } catch (err) {

        if (err.code === "23505") {
            return res.status(400).json({
                error: "Tên đăng nhập đã tồn tại."
            });
        }

        console.error(err);

        res.status(500).json({
            error: "Lỗi máy chủ."
        });

    }

});

router.post("/login", async (req, res) => {

    const { username, password } = req.body;

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE username = $1
            `,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Không tìm thấy tài khoản."
            });
        }

        const user = result.rows[0];

        if (user.password !== password) {
            return res.status(401).json({
                error: "Sai mật khẩu."
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

module.exports = router;