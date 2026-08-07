"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    if (res?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="hq-ambient" aria-hidden />
      <div className="relative z-10 panel hq-rise w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-[var(--r-md)] bg-white flex items-center justify-center text-[19px] font-bold text-[#0a0b0d]">
            M
          </div>
          <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            Hermy HQ
          </h1>
          <p className="eyebrow mt-2">Sign in to continue</p>
        </div>

        <div className="rule my-7" />

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--surface-2)] text-[var(--text)] rounded border border-[var(--border)] focus:outline-none focus:border-[var(--text)]"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--surface-2)] text-[var(--text)] rounded border border-[var(--border)] focus:outline-none focus:border-[var(--text)]"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button
            type="submit"
            className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2 mt-2"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}