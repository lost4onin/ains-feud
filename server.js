require("dotenv").config();

const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = Number(process.env.PORT) || 4173;
const databaseName = process.env.MYSQL_DATABASE || "ains_feud";

const connectionOptions = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || ""
};

let pool;

const seedRounds = [
  {
    name: "Round 1",
    question: "Name something AI helps people do faster",
    answers: [
      ["Write Emails", 32],
      ["Research", 24],
      ["Code", 18],
      ["Make Slides", 12],
      ["Summarize Notes", 8],
      ["Design Ideas", 6],
      ["Translate", 4],
      ["Plan Events", 2]
    ]
  },
  {
    name: "Round 2",
    question: "Name a job where AI can be a useful assistant",
    answers: [
      ["Teacher", 28],
      ["Doctor", 22],
      ["Programmer", 18],
      ["Designer", 12],
      ["Marketer", 8],
      ["Engineer", 6],
      ["Lawyer", 4],
      ["Student", 2]
    ]
  },
  {
    name: "Round 3",
    question: "Name something people ask a chatbot to do",
    answers: [
      ["Explain A Topic", 30],
      ["Write A Message", 20],
      ["Fix Code", 16],
      ["Make A Plan", 12],
      ["Translate Text", 8],
      ["Create Ideas", 6],
      ["Summarize A File", 5],
      ["Solve Homework", 3]
    ]
  },
  {
    name: "Round 4",
    question: "Name a concern people have about artificial intelligence",
    answers: [
      ["Job Loss", 27],
      ["Privacy", 21],
      ["Fake News", 16],
      ["Bias", 12],
      ["Security", 9],
      ["Cheating", 7],
      ["Cost", 5],
      ["Too Much Trust", 3]
    ]
  },
  {
    name: "Round 5",
    question: "Name a place you expect to see AI in the future",
    answers: [
      ["Hospitals", 26],
      ["Schools", 22],
      ["Cars", 18],
      ["Homes", 12],
      ["Banks", 8],
      ["Airports", 6],
      ["Factories", 5],
      ["Government", 3]
    ]
  }
];

function validateRound(body) {
  const name = String(body.name || "").trim();
  const question = String(body.question || "").trim();
  const answers = Array.isArray(body.answers) ? body.answers : [];

  if (!name || !question) {
    const error = new Error("Round name and question are required.");
    error.status = 400;
    throw error;
  }

  if (answers.length !== 8) {
    const error = new Error("Each round must have exactly 8 answers.");
    error.status = 400;
    throw error;
  }

  return {
    name: name.slice(0, 120),
    question: question.slice(0, 500),
    answers: answers.map((answer, index) => ({
      position: index + 1,
      text: String(answer.text || "").trim().slice(0, 255),
      points: Math.max(0, Math.min(999, Number(answer.points) || 0))
    }))
  };
}

async function insertSeedRound(connection, round) {
  const [result] = await connection.execute(
    "INSERT INTO rounds (name, question) VALUES (?, ?)",
    [round.name, round.question]
  );
  await connection.query(
    "INSERT INTO round_answers (round_id, position, answer_text, points) VALUES ?",
    [round.answers.map(([text, points], index) => [result.insertId, index + 1, text, points])]
  );
}

async function ensureSeedRounds() {
  const [existingRounds] = await pool.query("SELECT name FROM rounds");
  const existingNames = new Set(existingRounds.map((round) => round.name));
  const missingRounds = seedRounds.filter((round) => !existingNames.has(round.name));

  if (!missingRounds.length) {
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const round of missingRounds) {
      await insertSeedRound(connection, round);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function initializeDatabase() {
  const bootstrap = await mysql.createConnection(connectionOptions);
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrap.end();

  pool = mysql.createPool({
    ...connectionOptions,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      question VARCHAR(500) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS round_answers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      round_id INT UNSIGNED NOT NULL,
      position TINYINT UNSIGNED NOT NULL,
      answer_text VARCHAR(255) NOT NULL,
      points SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY unique_round_position (round_id, position),
      CONSTRAINT round_answers_round_fk FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await ensureSeedRounds();
}

async function getRound(id) {
  const [[round]] = await pool.execute(
    "SELECT id, name, question, created_at AS createdAt, updated_at AS updatedAt FROM rounds WHERE id = ?",
    [id]
  );

  if (!round) {
    return null;
  }

  const [answers] = await pool.execute(
    "SELECT answer_text AS text, points FROM round_answers WHERE round_id = ? ORDER BY position",
    [id]
  );
  round.answers = answers;
  return round;
}

app.use(express.json({ limit: "100kb" }));

app.get("/api/rounds", async (request, response, next) => {
  try {
    const [rounds] = await pool.query(
      "SELECT id, name, question, created_at AS createdAt, updated_at AS updatedAt FROM rounds ORDER BY id"
    );
    response.json(rounds);
  } catch (error) {
    next(error);
  }
});

app.get("/api/rounds/:id", async (request, response, next) => {
  try {
    const round = await getRound(Number(request.params.id));
    if (!round) {
      return response.status(404).json({ error: "Round not found." });
    }
    response.json(round);
  } catch (error) {
    next(error);
  }
});

app.post("/api/rounds", async (request, response, next) => {
  let connection;
  try {
    const round = validateRound(request.body);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "INSERT INTO rounds (name, question) VALUES (?, ?)",
      [round.name, round.question]
    );
    await connection.query(
      "INSERT INTO round_answers (round_id, position, answer_text, points) VALUES ?",
      [round.answers.map((answer) => [result.insertId, answer.position, answer.text, answer.points])]
    );
    await connection.commit();
    response.status(201).json(await getRound(result.insertId));
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.put("/api/rounds/:id", async (request, response, next) => {
  let connection;
  try {
    const id = Number(request.params.id);
    const round = validateRound(request.body);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "UPDATE rounds SET name = ?, question = ? WHERE id = ?",
      [round.name, round.question, id]
    );
    if (!result.affectedRows) {
      const error = new Error("Round not found.");
      error.status = 404;
      throw error;
    }
    await connection.execute("DELETE FROM round_answers WHERE round_id = ?", [id]);
    await connection.query(
      "INSERT INTO round_answers (round_id, position, answer_text, points) VALUES ?",
      [round.answers.map((answer) => [id, answer.position, answer.text, answer.points])]
    );
    await connection.commit();
    response.json(await getRound(id));
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get("/favicon.ico", (request, response) => response.status(204).end());

app.use((request, response, next) => {
  const privateFiles = new Set(["/.env", "/server.js", "/package.json", "/package-lock.json"]);
  if (privateFiles.has(request.path)) {
    return response.sendStatus(404);
  }
  next();
});

app.use(express.static(path.join(__dirname), { dotfiles: "deny" }));

app.use((error, request, response, next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.status ? error.message : "Database request failed." });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`AINS Feud running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not initialize MySQL:", error.message);
    process.exit(1);
  });
