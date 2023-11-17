import { Strategy as LocalStrategy } from "passport-local";
import  pool  from "./dbConfig.js";
import bcrypt from "bcrypt";

export function initializePassport(passport) {
    console.log("Initialized");

    const authenticateUser = ( email, password, done) => {
        console.log(email, password);
        pool.query(
            "SELECT * FROM users WHERE email = $1", [email],
            (err, results) => {
                if (err) {
                    throw err;
                }
                console.log(results.rows);

                if (results.rows.length > 0) {
                    const user = results.rows[0];

                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if (err) {
                            console.log(err);
                        }
                        if (isMatch) {
                            return done(null, user.id);
                        } else {
                            return done(null, false, {message: "Password is incorrect"});
                        }
                    });
                } else {
                    return done (null, false, {message: "No user with that email address"});
                }
            }
        )
    }

    passport.use(
        new LocalStrategy(
            {usernameField: "username", passwordField: "password"},
            authenticateUser
        )
    )

    passport.serializeUser((user, done) => done(null, user));

    passport.deserializeUser((id, done) => {
        pool.query(
            "SELECT * FROM users WHERE id = $1", [id], (err, results) => {
                if (err) {
                    return done(err);
                }
                console.log(`ID is ${results.rows[0].id}`);
                return done(null, results.rows[0])
            }
        )
    })
};

export default initializePassport;