"use client";

import { useState, useEffect } from "react";

interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  totalVotes: number;
  options: PollOption[];
}

export function PollWidget() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [voted, setVoted] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    fetch("/api/polls").then((r) => r.json()).then((data) => {
      if (data) {
        setPoll(data);
        const votedPolls = JSON.parse(localStorage.getItem("voted-polls") || "[]");
        if (votedPolls.includes(data.id)) setVoted(true);
      }
    }).catch(() => {});
  }, []);

  const handleVote = async () => {
    if (!selectedId || voted) return;

    await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: selectedId }),
    });

    // Update local state
    setPoll((prev) => {
      if (!prev) return null;
      const options = prev.options.map((o) => o.id === selectedId ? { ...o, votes: o.votes + 1 } : o);
      const totalVotes = options.reduce((s, o) => s + o.votes, 0);
      return {
        ...prev,
        totalVotes,
        options: options.map((o) => ({ ...o, percentage: Math.round((o.votes / totalVotes) * 100) })),
      };
    });

    setVoted(true);
    const votedPolls = JSON.parse(localStorage.getItem("voted-polls") || "[]");
    votedPolls.push(poll!.id);
    localStorage.setItem("voted-polls", JSON.stringify(votedPolls));
  };

  if (!poll) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>{"\uD83D\uDCCA"}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-brand)" }}>అభిప్రాయ సేకరణ</span>
      </div>

      <p style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 12, lineHeight: 1.5 }}>{poll.question}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {poll.options.map((opt) => (
          <div key={opt.id}>
            {voted ? (
              // Show results
              <div style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%",
                  width: `${opt.percentage}%`, background: opt.id === selectedId ? "var(--color-brand)" : "#e5e7eb",
                  opacity: opt.id === selectedId ? 0.15 : 0.5, transition: "width 0.5s",
                }} />
                <div style={{ position: "relative", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#333", fontWeight: opt.id === selectedId ? 700 : 400 }}>{opt.text}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>{opt.percentage}%</span>
                </div>
              </div>
            ) : (
              // Show voting options
              <label style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                borderRadius: 6, border: `1px solid ${selectedId === opt.id ? "var(--color-brand)" : "#e5e7eb"}`,
                cursor: "pointer", background: selectedId === opt.id ? "#fff1f1" : "#fff",
              }}>
                <input type="radio" name="poll" value={opt.id}
                  checked={selectedId === opt.id}
                  onChange={() => setSelectedId(opt.id)}
                  style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: "#333" }}>{opt.text}</span>
              </label>
            )}
          </div>
        ))}
      </div>

      {!voted && (
        <button onClick={handleVote} disabled={!selectedId} style={{
          width: "100%", marginTop: 10, padding: "8px 16px", borderRadius: 6,
          background: selectedId ? "var(--color-brand)" : "#e5e7eb",
          color: selectedId ? "#fff" : "#999", border: "none", fontSize: 13,
          fontWeight: 700, cursor: selectedId ? "pointer" : "not-allowed",
        }}>
          Vote
        </button>
      )}

      <p style={{ fontSize: 11, color: "#aaa", marginTop: 8, textAlign: "center" }}>
        {poll.totalVotes.toLocaleString()} votes
      </p>
    </div>
  );
}
