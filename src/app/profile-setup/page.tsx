"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileSetup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");

  // 🔐 Protect page + load email
  useEffect(() => {
    const storedEmail = localStorage.getItem("email");
    if (!storedEmail) {
      router.push("/login");
      return;
    }
    setEmail(storedEmail);
  }, [router]);

  async function handleSave() {
    setMessage("");

    if (!email || !name || !age || !role) {
      setMessage("Please fill all fields");
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          age,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to save profile");
        return;
      }

      setMessage("✅ Profile saved successfully");

      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      setMessage("Server error. Try again.");
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 500 }}>
      <h1>Complete Your Profile</h1>

      <input
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Age"
        value={age}
        onChange={(e) => setAge(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Target Role (e.g. Frontend Intern)"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      />

      <br /><br />

      <button onClick={handleSave}>Save Profile</button>

      {message && <p style={{ marginTop: 20 }}>{message}</p>}
    </div>
  );
}
