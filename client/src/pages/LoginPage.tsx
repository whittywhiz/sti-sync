import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [hint, setHint] = useState("Enter password to continue");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!password) {
      setHint("Password cannot be empty");
      setIsError(true);
      return;
    }

    setSubmitting(true);
    setHint("Signing in…");
    setIsError(false);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("authToken", data.token);
        navigate("/");
      } else {
        setHint(data.error || "Invalid password");
        setIsError(true);
      }
    } catch {
      setHint("Could not reach the server");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_12%_8%,rgba(224,187,81,0.16),transparent_42%),linear-gradient(155deg,#f4f6fa_0%,#e8ecf3_100%)] text-[#1c2733]">
      {}
      <svg
        className="pointer-events-none absolute -bottom-[24vw] -right-[18vw] h-[80vw] w-[80vw] max-h-[1100px] max-w-[1100px] opacity-90"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M40 320 C 140 260, 180 180, 140 90 C 260 130, 330 210, 300 340 Z"
          fill="rgba(47,95,158,0.055)"
        />
        <path
          d="M120 360 L 260 220 L 200 220 L 320 100 L 280 220 L 340 220 Z"
          fill="rgba(224,187,81,0.16)"
        />
      </svg>

      {/* Decorative ring, top-left */}
      <div className="pointer-events-none absolute -left-[16vw] -top-[18vw] h-[46vw] w-[46vw] max-h-[640px] max-w-[640px] rounded-full border-[1.5px] border-[rgba(47,95,158,0.14)] before:absolute before:inset-11 before:rounded-full before:border-[1.5px] before:border-[rgba(224,187,81,0.22)] before:content-['']" />

      {/* Brand */}
      <div className="relative mb-[34px] flex flex-col items-center">
        <img
          src="/icon.jpg"
          alt="STISync"
          className="block h-auto w-[min(230px,60vw)]"
        />
        <div className="mt-1.5 text-[12.5px] font-medium tracking-[2.5px] text-[#6b7788]">
          AUTOMATED TIMETABLING SYSTEM
        </div>
      </div>

      {/* Card */}
      <div className="relative flex w-[min(360px,88vw)] flex-col items-center rounded-[18px] border border-white/90 bg-white/72 px-[34px] pb-[30px] pt-10 shadow-[0_24px_60px_rgba(30,63,110,0.14),0_2px_8px_rgba(30,63,110,0.06)] backdrop-blur-[14px]">
        <div className="mb-6 text-xl font-semibold tracking-[0.2px] text-[#1c2733]">
          Admin
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="flex w-full flex-col items-center"
        >
          <div className="relative w-full">
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-[rgba(30,63,110,0.14)] bg-white/90 px-4 py-3 pr-11 text-[15px] text-[#1c2733] outline-none transition-colors placeholder:text-[#6b7788] focus:border-[#2f5f9e] focus:shadow-[0_0_0_4px_rgba(47,95,158,0.12)]"
            />
            <button
              type="submit"
              aria-label="Sign in"
              disabled={submitting}
              className="absolute right-[5px] top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full bg-[#e0bb51] text-[#1e3f6e] transition-all hover:bg-[#2f5f9e] hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <div
            className={`mt-3.5 min-h-[16px] text-[12.5px] ${isError ? "text-[#c1493f]" : "text-[#6b7788]"}`}
          >
            {hint}
          </div>
        </form>
      </div>
    </div>
  );
}
