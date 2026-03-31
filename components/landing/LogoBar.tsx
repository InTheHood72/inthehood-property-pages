export default function LogoBar() {
  const brands = [
    'Royal LePage', 'RE/MAX', 'Century 21', 'Keller Williams',
    'Coldwell Banker', 'Pillar 9', 'Sotheby\'s', 'EXIT Realty',
    'Royal LePage', 'RE/MAX', 'Century 21', 'Keller Williams',
    'Coldwell Banker', 'Pillar 9', 'Sotheby\'s', 'EXIT Realty',
  ];

  return (
    <section className="py-12 border-y border-[var(--ith-border)] bg-[var(--ith-surface)]" data-testid="logo-bar">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-[var(--ith-muted)] mb-8">
          Trusted by leading brokerages and agents
        </p>
      </div>
      <div className="overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--ith-surface)] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--ith-surface)] to-transparent z-10" />
        <div className="flex animate-scroll-logos">
          {brands.map((brand, i) => (
            <div
              key={i}
              className="flex-shrink-0 mx-8 flex items-center justify-center"
            >
              <span className="text-base font-semibold text-gray-300 whitespace-nowrap tracking-wider">
                {brand}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
