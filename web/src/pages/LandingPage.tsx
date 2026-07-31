import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f9f7f0] text-[#333333] flex flex-col justify-between">
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 md:px-12 h-24 bg-[#f9f7f0] border-b border-[#d0d5dd]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#2e96ff] text-white flex items-center justify-center font-black text-xl shadow-[rgba(154,207,246,0.5)_0px_5px_0px_0px]">
            A
          </div>
          <span className="text-2xl font-extrabold text-[#13426f] tracking-tight font-headline">Auditra</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 font-extrabold text-[#13426f] hover:text-[#2e96ff] transition-colors text-sm"
          >
            Log In
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-7 py-3 font-extrabold bg-[#2e96ff] text-white rounded-full shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] transition-all text-sm"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-20 max-w-5xl mx-auto flex-1">
        {/* Trust Badge Pill */}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#bde1f9] text-[#13426f] text-xs font-extrabold uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-[#2e96ff]"></span>
          Policy-First Automated Expense Validation
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-[#13426f] tracking-tight mb-6 font-headline leading-[1.1]">
          Audit Faster. <br />
          <span className="text-[#2e96ff]">Explain Better.</span>
        </h1>

        <p className="text-lg md:text-xl text-[#616c8a] max-w-2xl mb-10 font-medium leading-relaxed">
          Structured submissions meet live OCR parsing, vector RAG policy enforcement, and automatic audit validation — keeping every expense claim transparent and compliant.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate("/register")}
            className="px-9 py-4 font-extrabold bg-[#2e96ff] text-white rounded-full shadow-[rgba(154,207,246,0.5)_0px_7px_0px_0px] hover:translate-y-[2px] transition-all text-base"
          >
            Start Free Trial
          </button>
          <a
            href="#how-it-works"
            className="px-9 py-4 font-extrabold text-[#13426f] bg-white border border-[#d0d5dd] rounded-full hover:border-[#2e96ff] hover:text-[#2e96ff] transition-all text-base shadow-sm"
          >
            See How It Works
          </a>
        </div>
      </main>

      {/* Stat Headline Band */}
      <section className="bg-white border-y border-[#d0d5dd] py-14 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#13426f] font-headline tracking-tight">
            Over <span className="text-[#2e96ff]">99.4%</span> of Policy Mismatches Automatically Detected
          </h2>
          <p className="text-[#616c8a] mt-3 font-semibold text-sm">Powered by Multi-Engine OCR & Vector RAG Rules Engine</p>
        </div>
      </section>

      {/* Feature Section — Deep Navy Cards on Warm Cream Canvas */}
      <section id="how-it-works" className="py-20 px-6 bg-[#f9f7f0]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#13426f] text-center mb-14 font-headline">
            Three Steps to Instant Compliance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Deep Navy Card 1 */}
            <div className="bg-[#13426f] text-white p-8 rounded-[26px] shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-full bg-[#2e96ff] text-white flex items-center justify-center text-2xl mb-6 shadow-[rgba(154,207,246,0.5)_0px_4px_0px_0px]">
                  <Icon name="upload_file" />
                </div>
                <h3 className="text-2xl font-extrabold mb-3 text-white font-headline">1. Upload Claim</h3>
                <p className="text-[#bde1f9] text-sm leading-relaxed font-medium">
                  Employees input expenditure details and attach receipt proof for multi-pass OCR extractions.
                </p>
              </div>
              <div className="mt-8 text-xs font-bold text-[#bde1f9]/70 uppercase tracking-wider">Step 01</div>
            </div>

            {/* Deep Navy Card 2 */}
            <div className="bg-[#13426f] text-white p-8 rounded-[26px] shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-full bg-[#2e96ff] text-white flex items-center justify-center text-2xl mb-6 shadow-[rgba(154,207,246,0.5)_0px_4px_0px_0px]">
                  <Icon name="psychology" />
                </div>
                <h3 className="text-2xl font-extrabold mb-3 text-white font-headline">2. RAG Audit</h3>
                <p className="text-[#bde1f9] text-sm leading-relaxed font-medium">
                  Auditra retrieves corporate limit guidelines and cross-checks claim data against receipt text.
                </p>
              </div>
              <div className="mt-8 text-xs font-bold text-[#bde1f9]/70 uppercase tracking-wider">Step 02</div>
            </div>

            {/* Deep Navy Card 3 */}
            <div className="bg-[#13426f] text-white p-8 rounded-[26px] shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-full bg-[#2e96ff] text-white flex items-center justify-center text-2xl mb-6 shadow-[rgba(154,207,246,0.5)_0px_4px_0px_0px]">
                  <Icon name="gavel" />
                </div>
                <h3 className="text-2xl font-extrabold mb-3 text-white font-headline">3. Transparent Decision</h3>
                <p className="text-[#bde1f9] text-sm leading-relaxed font-medium">
                  Every decision comes with policy citations, mismatch flags, and risk assessments for human review.
                </p>
              </div>
              <div className="mt-8 text-xs font-bold text-[#bde1f9]/70 uppercase tracking-wider">Step 03</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#13426f] text-white py-12 px-6 border-t border-[#d0d5dd]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2e96ff] text-white flex items-center justify-center font-black text-base">
              A
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">Auditra Platform</span>
          </div>
          <p className="text-xs text-[#bde1f9]/80 font-semibold">
            © {new Date().getFullYear()} Auditra Inc. All rights reserved. Built with Relief Design Language.
          </p>
        </div>
      </footer>
    </div>
  );
}
