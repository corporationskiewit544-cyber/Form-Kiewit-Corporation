import express from "express";

const app = express();
app.use(express.json());

app.post("/api/submit", (req, res) => {
  console.log("Form submission:", req.body);
  res.status(200).json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
