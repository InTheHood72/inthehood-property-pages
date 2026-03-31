import { ArrowRight } from 'lucide-react';

export default function CTASection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden" data-testid="cta-section">
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--ith-forest)]" />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle at 30% 50%, var(--ith-green-400), transparent 60%), radial-gradient(circle at 80% 30%, var(--ith-green-300), transparent 50%)'
      }} />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-[family-name:var(--font-outfit)] text-4xl sm:text-5xl lg:text-6xl font-800 tracking-tight text-white leading-tight">
          Give Your Listings the Attention They Deserve
        </h2>
        <p className="text-lg text-green-200 mt-6 max-w-xl mx-auto leading-relaxed">
          From home to hood — create property presentations that capture buyers and convert leads.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <a
            href="https://app.inthehood.io"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[var(--ith-forest)] font-semibold hover:bg-green-50 transition-all group"
            data-testid="cta-get-started"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#showcase"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10 transition-all"
            data-testid="cta-explore"
          >
            Explore the Hood
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto">
          {[
            { value: '1,000+', label: 'Agents' },
            { value: '19K+', label: 'Properties' },
            { value: '99.9%', label: 'Uptime' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-[family-name:var(--font-outfit)] text-3xl font-800 text-white">{stat.value}</p>
              <p className="text-sm text-green-300 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
