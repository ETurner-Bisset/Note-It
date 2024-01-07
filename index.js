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
import ejsLint from "ejs-lint";
import favicon from "serve-favicon";
import path from "path";
import { fileURLToPath } from "url";
import _ from "lodash";

ejsLint("ejs", {async: true});

intializePassport(passport);

const app = express();
const port =  8080;

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

app.use(favicon(path.join(__dirname, "public", "favicon.ico")))

const date = new Date().getFullYear();

let done = false;

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(express.json());

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
    const noteTitles = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY id ASC", [id]);
    // console.log(noteTitles.rows);
    res.render("main-v2.ejs", {date: date, noteTitles: noteTitles.rows});
});

// Example note
app.get("/exampleNote", (req, res) => {
    if (req.isAuthenticated() ) {
        res.render("exampleNote.ejs", {date: date});
    } else {
        res.redirect("/login");
    }
})

app.get("/note", (req, res) => {
    const id = req.user.id;
    if (req.isAuthenticated()) {
        res.render("note.ejs", {date: date, id: id});
    } else {
        res.redirect("/login");
    }
});

app.get("/voiceNote", (req, res) => {
    const id = req.user.id;
    if (req.isAuthenticated()) {
        res.render("voiceNote.ejs", {date: date, id: id});
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
    const storedEmails = await pool.query("SELECT email FROM users");
    let emails = [];
    // console.log(email, password);
    let errors = [];
    if ( !email || !password || !password2) {
        errors.push({message: "Please enter all fields"});
    }
    storedEmails.rows.forEach((item) => {
        emails.push(item.email)
    })
    if (emails.includes(email)) {
        errors.push({message: "That email is already registered"})
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

// show single note
app.post("/showNote", async (req, res) => {
    const noteId = req.body.noteId;
    // console.log(typeof noteId);
    const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1", [noteId])
    const listItems = await pool.query("SELECT list_item, id, done, note_id FROM items WHERE note_id = $1 ORDER BY id ASC", [noteId]);
    console.log(listItems.rows);
    res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: noteId});
});
    
app.post("/note", async (req, res) => {
    const id = req.user.id;
    const noteTitle = req.body.listTitle;
    const items = [...req.body.item];
    // console.log(items);
    const message = {
        message: "You must enter a note"
    };
    const savedMessage = {
        message: "Your note was created"
    }
    if (items !== "") {
        try {
            const noteId = await pool.query("INSERT INTO notes (note_title, user_id) VALUES ($1, $2) RETURNING id", [noteTitle, id]);
            items.forEach(async (item) => {
                if (item !== "") {
                    // console.log(item);
                    await pool.query("INSERT INTO items (list_item, note_id, user_id, done) VALUES ($1, $2, $3, $4)", [item, noteId.rows[0].id, id, done]);
                }
            })
            const noteTitles = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY id ASC", [id]);
            // console.log(noteTitles.rows);
            res.render("main-v2.ejs", {date: date, noteTitles: noteTitles.rows, message: savedMessage});
        } catch (error) {
            console.log(error);
        }
    } else {
        res.render("note.ejs", {date: date, message: message, id: id})
    }
    
});

// Add voice note
app.post("/voiceNote", async (req, res) => {
    const id = req.user.id;
    const noteTitle = req.body.noteTitle;
    const noteBody = req.body.noteBody;
    const message = {
        message: "You must enter a note"
    };
    const savedMessage = {
        message: "Your voice note was created"
    };
    if (noteBody !== "") {
        try {
            const noteId = await pool.query("INSERT INTO notes (note_title, user_id) VALUES ($1, $2) RETURNING id", [noteTitle, id]);
            // console.log(noteId);
            await pool.query("INSERT INTO items ( list_item, note_id, user_id, done) VALUES ($1, $2, $3, $4)", [noteBody, noteId.rows[0].id, id, done]);
            const noteTitles = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY id ASC", [id]);
            // console.log(noteTitles.rows);
            res.render("main-v2.ejs", {date: date, noteTitles: noteTitles.rows, message: savedMessage});
        } catch (error) {
            console.log(error);
        }
    } else {
        res.render("voiceNote.ejs", {date: date, message: message, id: id})
    }
    
});

// Add single item
app.post("/add", ensureAuthenticated, async (req, res) => {
    const noteId = req.body.noteId;
    const id = req.user.id;
    const item = req.body.item;
    const addItemMessage = {
        message: "An item was added"
    };
    // console.log(parseInt(noteId));
    try {
        pool.query("INSERT INTO items (list_item, note_id, user_id, done) VALUES ($1, $2, $3, $4)", [item, parseInt(noteId), id, done]);
        const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1 ORDER BY id ASC", [parseInt(noteId)]);
        const listItems = await pool.query("SELECT list_item, id, done FROM items WHERE note_id = $1 ORDER BY id ASC", [parseInt(noteId)]);   
        res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: parseInt(noteId), message: addItemMessage});
    } catch (error) {
        console.log(error);
    }
});

// Edit single item
app.post("/edit", async (req, res) => {
   const itemId = req.body.updatedItemId;
   const updatedItem = req.body.updatedItem;
   const noteId = req.body.noteId;
   const editItemMessage = {
    message: "An item was edited"
   }
   try {
    await pool.query("UPDATE items SET list_item = $1 WHERE id = $2", [updatedItem, itemId]);
    const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1 ORDER BY id ASC", [parseInt(noteId)]);
    const listItems = await pool.query("SELECT list_item, id FROM items WHERE note_id = $1 ORDER BY id ASC", [parseInt(noteId)]);   
    res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: parseInt(noteId), message: editItemMessage});
   } catch (error) {
    console.log(error);
   }
});

// Edit title 
app.post("/editTitle", async (req, res) => {
    const updatedTitle = req.body.updatedTitle;
    const noteId = req.body.noteId;
    const editTitleMessage = {
        message: "Your title was edited"
    }
    try {
        await pool.query("UPDATE notes SET note_title = $1 WHERE id = $2", [updatedTitle, noteId]);
        const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1 ORDER BY id ASC", [parseInt(noteId)]);
        const listItems = await pool.query("SELECT list_item, id FROM items WHERE note_id = $1 ORDER BY id ASC", [parseInt(noteId)]);   
        res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: parseInt(noteId), message: editTitleMessage});
    } catch (error) {
        console.log(error);
    }
});

// Check off single item
app.post("/checkOff", async (req, res) => {
    try {
        const item = req.body.checkbox;
        const doneStatus = await pool.query("UPDATE items SET done = NOT done WHERE list_item = $1 RETURNING done", [item]);
        // console.log(doneStatus.rows[0]);
        const noteId = req.body.noteId;
        // console.log(typeof parseInt(noteId));
        const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1", [parseInt(noteId)])
        const listItems = await pool.query("SELECT list_item, id, done, note_id FROM items WHERE note_id = $1 ORDER BY id ASC", [parseInt(noteId)]);
        // console.log(listItems.rows);
        res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: parseInt(noteId), doneStatus: doneStatus.rows[0].done});
        } catch (error) {
            console.log(error);
        }
})

// Delete single item
app.post("/delete", async (req, res) => {
    const itemId = req.body.itemId;
    const deleteItemMessage = {
        message: "An Item was deleted"
    }
    try {
        const noteId = await pool.query("DELETE FROM items WHERE id = $1 RETURNING note_id", [itemId]);
        // console.log(parseInt(noteId.rows[0].note_id));
        const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1 ", [parseInt(noteId.rows[0].note_id)]);
        const listItems = await pool.query("SELECT list_item, id, done, note_id FROM items WHERE note_id = $1 ORDER BY id ASC", [parseInt(noteId.rows[0].note_id)]);
        // console.log(listItems);
        res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: parseInt(noteId.rows[0].note_id), message: deleteItemMessage});
    } catch (error) {
        console.log(error);
    }
})
//  Delete whole note
app.post("/delete-note", async (req, res) => {
    const id = req.user.id;
    const noteId = req.body.noteId;
    // console.log(noteId);
    const deleteMessage = {
        message: "Your note was deleted"
    };
    try {
        await pool.query("DELETE FROM items WHERE note_id = $1", [noteId]);
        await pool.query("DELETE FROM notes WHERE id = $1", [noteId]);
        const noteTitles = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY id ASC", [id]);
        // console.log(noteTitles.rows);
        res.render("main-v2.ejs", {date: date, noteTitles: noteTitles.rows, message: deleteMessage});
    } catch (error) {
        console.log(error); 
    }
});

// search note title 
app.post("/search", async (req, res) => {
    const searchtitle = req.body.searchTitle;
    // console.log(searchtitle);
    const searchedTitle = await pool.query("SELECT note_title FROM notes WHERE note_title = $1", [searchtitle]);
    if (searchedTitle.rows.length < 1) {
        const noteId = await pool.query("SELECT id FROM notes WHERE note_title = $1", [searchtitle])
        // console.log(noteId.rows);
        res.render("showNote.ejs", {date: date, noteId: noteId.rows})
    } else {
        try {
            const noteId = await pool.query("SELECT id FROM notes WHERE note_title = $1", [searchtitle])
            // console.log(noteId.rows[0].id);
            const noteTitle = await pool.query("SELECT note_title FROM notes WHERE id = $1", [noteId.rows[0].id])
            const listItems = await pool.query("SELECT list_item, id, done, note_id FROM items WHERE note_id = $1 ORDER BY id ASC", [noteId.rows[0].id]);
            res.render("showNote.ejs", {date: date, noteTitle: noteTitle.rows[0].note_title, listItems: listItems.rows, noteId: noteId.rows[0].id}); 
        
    } catch (error) {
        console.log(error);
    }
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

async function getHighestId(arr) {
    arr.sort((a, b) => b - a);
    return arr[0];
};

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});