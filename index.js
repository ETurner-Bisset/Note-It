import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import pool  from "./dbConfig.js";
import passport from "passport";
import flash from "express-flash";
import session from "express-session";
import bcrypt from "bcrypt";
import intializePassport from "./passportConfig.js";

intializePassport(passport);

const app = express();
const port =  3000;

const date = new Date().getFullYear();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret: process.env.SECRET ,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get("/", (req, res) => {
    res.render("index.ejs", {date: date});
});

app.get("/register", checkAuthenticated, (req, res) => {
    res.render("register.ejs", {date: date});
});

app.get("/login", checkAuthenticated, (req, res) => {
    res.render("login.ejs", {date: date});
});

app.get("/main", ensureAuthenticated, async (req, res) => {
    const id = req.user.id;
    // console.log(id);
    const notes = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY id ASC", [id]);
    console.log(notes.rows);
    res.render("main.ejs", {date: date, notes: notes.rows});
});

app.get("/note", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("note.ejs", {date: date});
    } else {
        res.redirect("/login");
    }
});

app.get("/logout", (req, res) => {
    req.logout(function(err) {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    })
});

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    const password2 = req.body.password2;

    console.log(email, password);

    let errors = [];

    if ( !email || !password || !password2) {
        errors.push({message: "Please enter all fields"});
    }

    if (password.length < 6) {
        errors.push({message: "Password should be at least 6 characters"});
    }

    if (password !== password2) {
        errors.push({message: "Passwords do not match"});
    }

    if (errors.length > 0 ) {
        res.render("register.ejs", {errors, date: date})
    } else {
        let hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
        "SELECT * FROM users WHERE email = $1", [email], (err, results) => {
            if (err) {
                console.log(err);
            } 
            console.log(results.rows);

            if (results.rows.length > 0) {
                return res.render("register", {errors})
            } else {
                pool.query(
                    "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, password", [email, hashedPassword], (err, results) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log(results.rows);
                        req.flash("success_msg", "You are now registered, please login");
                        res.redirect("/login");
                    }
                )
            }


        }

       
    )
    }

    

});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/main",
    failureRedirect: "/login",
    failureFlash: true
}));
    
app.post("/note", (req, res) => {
    const id = req.user.id;
    const note = req.body.note;
    try {
        pool.query("INSERT INTO notes (notes, user_id) VALUES ($1, $2)", [note, id]);
        res.redirect("/main");
    } catch (error) {
        console.log(error);
    }
});

app.post("/edit", async (req, res) => {
    const noteId = req.body.noteId;
    // console.log(noteId);
    const note = await pool.query("SELECT notes FROM notes WHERE id = $1", [noteId]);
    console.log(note.rows[0].notes);
    if (req.isAuthenticated()) {
        res.render("edit.ejs", {date: date, note: note.rows[0].notes, noteId: noteId});
    } else {
        res.redirect("/login");
    }
});

app.post("/editNote", (req, res) => {
    const updatedNote = req.body.updatedNote;
    const noteId = req.body.noteId;
    try {
        pool.query("UPDATE notes SET notes = $1 WHERE id = $2", [updatedNote, noteId]);
        res.redirect("/main");
    } catch (error) {
        console.log(error);
    }
});

app.post("/delete", (req, res) => {
    const noteId = req.body.noteId;
    try {
       pool.query("DELETE FROM notes WHERE id = $1", [noteId]);
       res.redirect("/main");
    } catch (error) {
       console.log(error); 
    }
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        req.session.userId = req.user.id;
        return next()
    }
    res.redirect("/login");
};

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect("/main");
    }
    next();
  }
  
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/login");
  }

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});