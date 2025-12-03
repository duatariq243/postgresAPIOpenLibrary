import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

// ---------- Database ----------
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "library",
  password: "Duaali@123",
  port: 5432,
});

await db.connect();

// ---------- Middleware ----------

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// ---------- Home Page: List Saved Books ----------
app.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM books ORDER BY id ASC");
  res.render("index.ejs", { books: result.rows });
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
app.post("/add", async (req, res) => {
  const { title, author, cover_id } = req.body;

  await db.query(
    "INSERT INTO books (title, author, cover_id) VALUES ($1, $2, $3)",
    [title, author, cover_id]
  );

  res.redirect("/");
});

// ---------- Show Edit Page ----------
app.get("/edit/:id", async (req, res) => {
  const id = req.params.id;
  const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);
  res.render("edit.ejs", { book: result.rows[0] });
});

// ---------- Edit Book ----------
app.post("/edit/:id", async (req, res) => {
  const id = req.params.id;
  const { title, author } = req.body;

  await db.query(
    "UPDATE books SET title=$1, author=$2 WHERE id=$3",
    [title, author, id]
  );

  res.redirect("/");
});

// ---------- Delete Book ----------
app.post("/delete/:id", async (req, res) => {
  const id = req.params.id;
  await db.query("DELETE FROM books WHERE id=$1", [id]);
  res.redirect("/");
});

// ---------- Start Server ----------
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
