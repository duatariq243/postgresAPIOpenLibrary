import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

const app = express();
const port = 3000;
dotenv.config();

// ---------- Database ----------
const db = new pg.Client({
  user: process.env.DB_USER,
  host:process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

await db.connect();

// ---------- Middleware ----------

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


const authenticateToken = (req, res, next) => {
  const token = req.cookies.token; // get JWT from cookie
  if (!token) {
    return res.redirect("/login?message=You must login first");
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.redirect("/login?message=Session expired, login again");
    req.user = user;
    next();
  });
};


app.use(cookieParser());

app.use((req, res, next) => {
  const token = req.cookies.token;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) res.locals.user = user;
      next();
    });
  } else {
    next();
  }
});




// ---------- Home Page: List Saved Books ----------
app.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM books ORDER BY id ASC");
  res.render("index.ejs", { books: result.rows });
});
//--------login-----//JWT////
// Register user
app.get("/register", (req, res) => res.render("register.ejs"));
app.get("/login", (req, res) => {
  res.render("login.ejs", { query: req.query });
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
    [username, email, hashedPassword]
  );

  res.redirect("/login");
  
});

// Login user
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
  const user = result.rows[0];

  if (!user) return res.send("User not found");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.send("Invalid credentials");

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  // Set JWT as HTTP-only cookie
  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 3600000, // 1 hour
  });

  // Redirect to homepage after login
  res.redirect("/");
});


app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login?message=Logged out successfully");
});


// ---------- Show Search Page ----------
app.get("/search", (req, res) => {
  res.render("search.ejs", { results: null });
});

// ---------- Handle Search Form ----------
app.post("/search", async (req, res) => {
  const q = req.body.query;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}`;

  const response = await axios.get(url);
  const docs = response.data.docs.slice(0, 10); // only 10 results

  const results = docs.map((book) => ({
    title: book.title,
    author: book.author_name ? book.author_name[0] : "Unknown",
    cover_id: book.cover_i || null,
  }));

  res.render("search.ejs", { results });
});

// ---------- Add Book to DB ----------


// Add Book
app.post("/add", authenticateToken, async (req, res) => {
  const { title, author, cover_id } = req.body;
  await db.query(
    "INSERT INTO books (title, author, cover_id) VALUES ($1, $2, $3)",
    [title, author, cover_id]
  );
  res.redirect("/");
});

// Edit Book
// Show Edit Page
app.get("/edit/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);
  if (!result.rows[0]) {
    return res.send("Book not found");
  }
  res.render("edit.ejs", { book: result.rows[0] });
});

app.post("/edit/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const { title, author } = req.body;
  await db.query("UPDATE books SET title=$1, author=$2 WHERE id=$3", [title, author, id]);
  res.redirect("/");
});

// Delete Book
app.post("/delete/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  await db.query("DELETE FROM books WHERE id=$1", [id]);
  res.redirect("/");
});
// ---------- Start Server ----------
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
