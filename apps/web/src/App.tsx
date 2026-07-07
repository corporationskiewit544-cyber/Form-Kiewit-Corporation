import { type FormEvent, useState } from "react";

export default function App() {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const formData = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main>
      <h1>Kiewit Corporation Form</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <button type="submit" disabled={status === "submitting"}>
          Submit
        </button>
      </form>
      {status === "done" && <p>Submitted successfully.</p>}
      {status === "error" && <p>Something went wrong. Please try again.</p>}
    </main>
  );
}
