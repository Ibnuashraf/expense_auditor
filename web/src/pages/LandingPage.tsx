import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="flex items-center justify-between p-6 border-b border-outline/30 bg-surface-container-low/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
            <Icon name="verified" />
          </div>
          <span className="text-xl font-bold font-[family-name:var(--font-headline)]">Auditra</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2 font-semibold text-primary hover:bg-surface-container-low rounded-lg transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-5 py-2 font-semibold bg-primary text-on-primary rounded-lg shadow-md hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 animate-in slide-in-from-bottom flex-1 fade-in duration-700 relative overflow-hidden">
        <div className="absolute -top-16 right-0 w-[420px] h-[420px] rounded-full bg-secondary-container/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 -left-20 w-[420px] h-[420px] rounded-full bg-primary-fixed/20 blur-[120px] pointer-events-none" />
        <div className="inline-block px-4 py-1.5 rounded-full bg-surface-container-high text-sm font-semibold mb-6">
          Audit with Aura
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl font-[family-name:var(--font-headline)] leading-tight">
          Audit Faster. Explain Better. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-fixed to-primary-container">Powered by the Aura in Auditra.</span>
        </h1>
        <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mb-12">
          Give every claim an aura of transparency: structured submissions meet live OCR, policy rules, and RAG-grounded explanations so auditors see extracted facts—not empty fields.
        </p>
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/register")}
            className="px-8 py-4 font-bold bg-primary text-on-primary rounded-xl shadow-lg hover:scale-105 transition-transform text-lg"
          >
            Create Account
          </button>
          <a
            href="#learn-about"
            className="px-8 py-4 font-semibold hover:bg-surface-container-low rounded-xl transition-colors text-lg"
          >
            See How It Works
          </a>
        </div>
      </main>

      <section id="learn-about" className="py-24 bg-surface-container mt-12 px-6 border-t border-outline/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 font-[family-name:var(--font-headline)]">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center p-6 bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-full bg-primary-container text-primary flex items-center justify-center text-3xl mb-6">
                <Icon name="upload_file" />
              </div>
              <h3 className="text-xl font-bold mb-3">1. Submit Complete Expense</h3>
              <p className="text-on-surface-variant">
                Employees provide all mandatory fields and upload a receipt for strict OCR extraction.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-full bg-primary-container text-primary flex items-center justify-center text-3xl mb-6">
                <Icon name="psychology" />
              </div>
              <h3 className="text-xl font-bold mb-3">2. OCR + Policy Validation</h3>
              <p className="text-on-surface-variant">
                Auditra cross-checks user inputs against OCR output and retrieves governing policy with RAG.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-full bg-primary-container text-primary flex items-center justify-center text-3xl mb-6">
                <Icon name="gavel" />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Clear Audit Decision</h3>
              <p className="text-on-surface-variant">
                Every verdict includes an unambiguous reason statement tied to policy evidence for transparent review.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
