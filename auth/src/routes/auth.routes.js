import { Router } from "express";
import User from "../models/user.model.js";
import passport from "passport";
import jwt from "jsonwebtoken";
import { sendAuthNotification } from "../config/mq.js";

const router = Router();


// ================================
// GOOGLE LOGIN
// ================================

router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        accessType: "offline",
        prompt: "consent",
    })
);


// ================================
// GOOGLE CALLBACK
// ================================

router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: "/",
    }),
    async (req, res) => {
        try {
            const {
                id,
                displayName,
                emails,
                photos,
            } = req.user;

            let user = await User.findOne({
                googleId: id,
            });


            // ================================
            // CREATE USER IF FIRST LOGIN
            // ================================

            if (!user) {
                user = new User({
                    googleId: id,
                    email: emails[0].value,
                    name: displayName,
                    avatar: photos[0].value,
                });

                await user.save();
            }


            // ================================
            // SEND AUTH NOTIFICATION
            // ================================

            await sendAuthNotification({
                userId: user._id,
                action: "google_login",
                timestamp: new Date(),
                email: emails[0].value,
            });


            // ================================
            // GENERATE JWT
            // ================================

            const token = jwt.sign(
                {
                    id: user._id,
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h",
                }
            );


            // ================================
            // SET COOKIE
            // ================================

            res.cookie("token", token, {
                httpOnly: true,
            });


            // ================================
            // REDIRECT
            // ================================

            res.redirect("/");

        } catch (err) {
            console.error(
                "Error during Google authentication:",
                err
            );

            res.redirect("/");
        }
    }
);


export default router;