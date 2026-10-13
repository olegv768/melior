import Nav from './components/Nav'
import Hero from './components/hero/Hero'
import Upload from './components/Upload'
import Marketplaces from './components/Marketplaces'
import Funnel from './components/Funnel'
import Audit from './components/Audit'
import HowItWorks from './components/HowItWorks'
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
        <Upload />
        <Marketplaces />
        <Funnel />
        <Audit />
        <HowItWorks />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
