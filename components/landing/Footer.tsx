import Image from 'next/image';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Embed Generator', 'Templates', 'MLS Search'],
  Resources: ['Blog', 'Help Center', 'API Docs', 'Neighbourhood Guides'],
  Company: ['About', 'Careers', 'Contact', 'Privacy', 'Terms'],
};

export default function Footer() {
  return (
    <footer className="bg-[var(--ith-forest-deep)] text-white" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Image
              src="/landing/logos/logo-light-full.png"
              alt="InTheHood"
              width={140}
              height={32}
              className="h-7 w-auto mb-4"
            />
            <p className="text-sm text-green-200/70 max-w-xs leading-relaxed">
              The all-in-one platform for real estate agents to showcase properties and neighbourhoods with stunning landing pages.
            </p>
            <div className="flex gap-3 mt-6">
              {['X', 'In', 'IG', 'YT'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-bold text-green-200 transition-colors"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-semibold text-white mb-4">{heading}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-green-200/60 hover:text-white transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-green-200/40">
            &copy; {new Date().getFullYear()} InTheHood. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-green-200/40 hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-green-200/40 hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
