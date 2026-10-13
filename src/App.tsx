import Nav from './components/Nav'
import Hero from './components/hero/Hero'
import Analytics from './components/Analytics'
import Audit from './components/Audit'
import Marketplaces from './components/Marketplaces'
import Capabilities from './components/Capabilities'
import HowItWorks from './components/HowItWorks'
import BeforeAfter from './components/BeforeAfter'
import Industries from './components/Industries'
import SampleReport from './components/SampleReport'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Analytics />
        <Audit />
        <Marketplaces />
        <Capabilities />
        <HowItWorks />
        <BeforeAfter />
        <Industries />
        <SampleReport />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
