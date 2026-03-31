import '../../globals.css'
import Providers from '../../../providers/Provider'

export default function NumeroDarkLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      {/* Numero Dark templates have their own sticky header, so we skip the default Header here */}
      {children}
      {/* Also skip default Footer - Numero templates have their own footer section */}
    </Providers>
  )
}
