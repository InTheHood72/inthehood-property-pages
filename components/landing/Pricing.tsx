import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Solo',
    price: '$49',
    period: 'per listing',
    description: 'Perfect for individual listings',
    features: [
      '1 Custom Branded Presentation',
      'Active 60 Days',
      'Mobile Ready',
      'Neighbourhood Profile',
      'Tour Scheduler',
      'CRM Access',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Trifecta',
    price: '$119',
    period: 'per package',
    description: 'Save $30 on three listings',
    features: [
      '3 Property Presentations',
      'Active 90 Days',
      'All Solo Features',
      'Priority Design Queue',
      'Custom Branding',
      'Analytics Dashboard',
    ],
    cta: 'Choose Trifecta',
    popular: true,
  },
  {
    name: 'Nickel',
    price: '$149',
    period: 'per package',
    description: 'Top position in search, save $96',
    features: [
      '5 Property Presentations',
      'Active 120 Days',
      'All Solo Features',
      'Top Search Position',
      'Video Shorts Included',
      'Dedicated Support',
    ],
    cta: 'Choose Nickel',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32" data-testid="pricing-section">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[var(--ith-green-500)] mb-4">
            Pricing
          </span>
          <h2 className="font-[family-name:var(--font-outfit)] text-4xl sm:text-5xl font-800 tracking-tight text-[var(--ith-forest-deep)]">
            Flexible Plans for Every Agent
          </h2>
          <p className="text-base text-[var(--ith-muted)] mt-4 leading-relaxed">
            Start with a single listing or bundle for better value. No subscriptions, no hidden fees.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card relative rounded-2xl p-8 ${
                plan.popular
                  ? 'bg-[var(--ith-forest)] text-white ring-2 ring-[var(--ith-green-400)] scale-[1.03]'
                  : 'bg-white border border-[var(--ith-border)]'
              }`}
              data-testid={`pricing-card-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--ith-green-400)] text-[var(--ith-forest-deep)] text-xs font-bold">
                  Most Popular
                </span>
              )}

              <h3 className={`font-[family-name:var(--font-outfit)] text-lg font-700 ${plan.popular ? 'text-white' : 'text-[var(--ith-forest-deep)]'}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mt-1 ${plan.popular ? 'text-green-200' : 'text-[var(--ith-muted)]'}`}>
                {plan.description}
              </p>

              <div className="mt-6 mb-8">
                <span className={`font-[family-name:var(--font-outfit)] text-4xl font-800 ${plan.popular ? 'text-white' : 'text-[var(--ith-forest-deep)]'}`}>
                  {plan.price}
                </span>
                <span className={`text-sm ml-1 ${plan.popular ? 'text-green-200' : 'text-[var(--ith-muted)]'}`}>
                  {plan.period}
                </span>
              </div>

              <a
                href="https://app.inthehood.io"
                className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.popular
                    ? 'bg-white text-[var(--ith-forest)] hover:bg-green-50'
                    : 'bg-[var(--ith-forest)] text-white hover:bg-[var(--ith-forest-deep)]'
                }`}
                data-testid={`pricing-cta-${plan.name.toLowerCase()}`}
              >
                {plan.cta}
              </a>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-[var(--ith-green-400)]' : 'text-[var(--ith-green-500)]'}`} />
                    <span className={`text-sm ${plan.popular ? 'text-green-100' : 'text-[var(--ith-muted)]'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
